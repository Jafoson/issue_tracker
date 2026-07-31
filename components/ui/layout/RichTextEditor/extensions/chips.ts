import { mergeAttributes, Node } from "@tiptap/core";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import { Suggestion, type SuggestionOptions } from "@tiptap/suggestion";
import { formatChipDate } from "@/lib/richtext/date";
import { faviconStyle, hostOf } from "@/lib/richtext/link";
// Dieselben Klassen wie in der Anzeige: der `Chip`-Atom gibt die Form, die
// Rich-Text-Styles das Zeichen davor. Ein Chip muss beim Schreiben genauso
// aussehen wie danach beim Lesen, sonst springt der Text beim Speichern.
//
// Nur die Klassen, nicht die Komponente — `renderHTML` baut reines DOM, React
// gibt es hier nicht.
import atom from "../../Chip/chip.module.scss";
import chip from "../../RichText/richText.module.scss";
import type { SuggestionItem } from "../components/SuggestionMenu/SuggestionMenu";

/** Was `<Chip as="span" size="inline" variant="elevated">` erzeugt. */
const CHIP_CLASS = [atom.chip, atom.elevated, atom.inline].join(" ");

/** Dasselbe mit einem Zeichen im Icon-Slot davor. */
const CHIP_CLASS_ICON = `${CHIP_CLASS} ${atom.hasIcon}`;

/**
 * Die vier Einsprengsel im Fließtext: Erwähnung, Issue, Datum und Emoji.
 *
 * Alle vier sind Inline-Atome — ein einzelnes Zeichen im Dokument, das seinen
 * Inhalt in den Attributen trägt und sich nicht von innen bearbeiten lässt.
 * Genau deshalb sind sie hier zusammengefasst: sie unterscheiden sich nur in
 * ihren Attributen und ihrer Beschriftung.
 *
 * Die Attribute wandern als `data-*` ins HTML, damit Kopieren und Einfügen
 * zwischen zwei Editoren den Chip erhält statt ihn zu Text zu zerlegen.
 *
 * Welcher Trigger einen Chip öffnet, steht nicht hier: das reicht der Editor
 * über `.configure({ suggestion })` herein, weil die Daten dahinter fachlich
 * sind (Mitglieder, Issues) und `components/ui` davon nichts wissen soll.
 */

export interface ChipOptions {
  suggestion: Omit<SuggestionOptions<SuggestionItem>, "editor"> | null;
}

interface ChipConfig {
  name: string;
  /** Attributnamen samt Vorgabewert. */
  attrs: Record<string, string | null>;
  className?: string;
  /** Was im Chip steht. */
  label: (attrs: Record<string, unknown>) => string;
  /**
   * Ein Baustein vor dem Text — der Avatar der Erwähnung. Raute und Kalender
   * brauchen ihn nicht: die stehen als Maske im CSS und gelten damit für
   * Editor und Anzeige gleichermaßen.
   */
  lead?: (attrs: Record<string, unknown>) => DOMOutputSpec | null;
  /** Zusätzliche Klasse auf der Beschriftung — beim Issue die Festbreitenschrift. */
  labelClass?: string;
  /** Was beim Überfahren erscheint — beim Link seine Adresse. */
  titleOf?: (attrs: Record<string, unknown>) => string | undefined;
  /**
   * Die reine Textform — beim Kopieren und für `editor.getText()`. Ohne Angabe
   * dieselbe wie `label`; die Erwähnung stellt hier ihr `@` voran, das im Chip
   * selbst überflüssig wäre.
   */
  text?: (attrs: Record<string, unknown>) => string;
}

/** `identifier` → `data-identifier`, `checkedAt` → `data-checked-at` */
function dataName(key: string): string {
  return `data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

function createChip({
  name,
  attrs,
  className,
  label,
  lead,
  labelClass,
  titleOf,
  text,
}: ChipConfig) {
  return Node.create<ChipOptions>({
    name,
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,

    addOptions() {
      return { suggestion: null };
    },

    addAttributes() {
      return Object.fromEntries(
        Object.entries(attrs).map(([key, fallback]) => [
          key,
          {
            default: fallback,
            parseHTML: (element: HTMLElement) =>
              element.getAttribute(dataName(key)) ?? fallback,
            renderHTML: (value: Record<string, unknown>) =>
              value[key] == null ? {} : { [dataName(key)]: String(value[key]) },
          },
        ]),
      );
    },

    parseHTML() {
      return [{ tag: `span[data-chip="${name}"]` }];
    },

    renderHTML({ node, HTMLAttributes }) {
      const title = titleOf?.(node.attrs);
      const attributes = mergeAttributes(HTMLAttributes, {
        "data-chip": name,
        ...(className ? { class: className } : {}),
        ...(title ? { title } : {}),
      });

      // Ohne Chip-Hülle (das Emoji) bleibt es beim nackten Zeichen — die Slots
      // des Atoms hätten dort nichts zu halten.
      if (!className) return ["span", attributes, label(node.attrs)];

      const before = lead?.(node.attrs);
      return [
        "span",
        attributes,
        // Dieselben Slots wie im Atom: Zeichen davor, dann die Beschriftung.
        ...(before ? [["span", { class: atom.icon }, before]] : []),
        [
          "span",
          { class: [atom.label, labelClass].filter(Boolean).join(" ") },
          label(node.attrs),
        ],
      ] as DOMOutputSpec;
    },

    /** Für Kopieren als reiner Text und für `editor.getText()`. */
    renderText({ node }) {
      return (text ?? label)(node.attrs);
    },

    addProseMirrorPlugins() {
      const { suggestion } = this.options;
      if (!suggestion) return [];
      return [Suggestion({ editor: this.editor, ...suggestion })];
    },
  });
}

/**
 * Ein erwähntes Mitglied: `@` und der Name.
 *
 * Das `@` steht im Text und nicht in einem eigenen Slot — so trägt es die
 * Grundlinie des Fließtexts von selbst und wird beim Markieren mitkopiert.
 */
export const MentionChip = createChip({
  name: "mention",
  attrs: { id: null, label: "" },
  className: CHIP_CLASS,
  label: (a) => `@${a.label ?? ""}`,
});

/** `ORB-42` — verweist über den lesbaren Schlüssel, damit er im Text steht. */
export const IssueLinkChip = createChip({
  name: "issueLink",
  attrs: { id: null, identifier: "" },
  className: CHIP_CLASS_ICON,
  label: (a) => String(a.identifier ?? ""),
  labelClass: chip.issueLinkLabel,
  lead: () => ["span", { class: chip.issueIcon, "aria-hidden": "true" }],
});

/**
 * Ein Link auf eine fremde Seite.
 *
 * Neben Adresse und Name kein weiteres Attribut: das Icon leitet sich aus der
 * Adresse ab, und ein mitgespeicherter Pfad veraltete nur.
 */
export const LinkChip = createChip({
  name: "linkChip",
  attrs: { href: "", label: "" },
  className: CHIP_CLASS_ICON,
  // Ohne Namen steht der Hostname da — besser als eine nackte lange Adresse.
  label: (a) => String(a.label || hostOf(String(a.href ?? ""))),
  text: (a) => String(a.href ?? ""),
  // Der Chip zeigt den Namen — die Adresse dahinter erscheint beim Überfahren.
  titleOf: (a) => String(a.href ?? "") || undefined,
  lead: (a) => [
    "span",
    {
      class: chip.linkIcon,
      style: faviconStyle(String(a.href ?? "")) ?? "",
      "aria-hidden": "true",
    },
  ],
});

/**
 * Ein Datum. Gespeichert wird ISO, angezeigt die lokale Schreibweise — so
 * bleibt der Wert eindeutig und die Anzeige trotzdem lesbar.
 */
export const DateChip = createChip({
  name: "dateChip",
  attrs: { date: "" },
  className: CHIP_CLASS_ICON,
  label: (a) => formatChipDate(String(a.date ?? "")),
  lead: () => ["span", { class: chip.dateIcon, "aria-hidden": "true" }],
});

/**
 * Emoji als eigener Knoten statt als Zeichen im Text: so bleibt der Kurzname
 * erhalten und `toPlainText` kann ihn für die Suche mitnehmen. Ohne eigene
 * Klasse — ein Emoji braucht keinen Rahmen.
 */
export const EmojiChip = createChip({
  name: "emoji",
  attrs: { name: "", emoji: "" },
  label: (a) => String(a.emoji ?? ""),
});
