import { mergeAttributes, Node } from "@tiptap/core";
import { Suggestion, type SuggestionOptions } from "@tiptap/suggestion";
// Bewusst die Styles der Anzeige: ein Chip muss beim Schreiben genauso
// aussehen wie danach beim Lesen, sonst springt der Text beim Speichern.
import chip from "../../RichText/richText.module.scss";
import type { SuggestionItem } from "../components/SuggestionMenu/SuggestionMenu";

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
  /** Was im Editor sichtbar ist. */
  label: (attrs: Record<string, unknown>) => string;
}

/** `identifier` → `data-identifier`, `checkedAt` → `data-checked-at` */
function dataName(key: string): string {
  return `data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

function createChip({ name, attrs, className, label }: ChipConfig) {
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
      return [
        "span",
        mergeAttributes(HTMLAttributes, {
          "data-chip": name,
          ...(className ? { class: className } : {}),
        }),
        label(node.attrs),
      ];
    },

    /** Für Kopieren als reiner Text und für `editor.getText()`. */
    renderText({ node }) {
      return label(node.attrs);
    },

    addProseMirrorPlugins() {
      const { suggestion } = this.options;
      if (!suggestion) return [];
      return [Suggestion({ editor: this.editor, ...suggestion })];
    },
  });
}

/** `@Anna Weber` — verweist über die Benutzer-ID, zeigt den Namen. */
export const MentionChip = createChip({
  name: "mention",
  attrs: { id: null, label: "" },
  className: chip.mention,
  label: (a) => `@${a.label ?? ""}`,
});

/** `ORB-42` — verweist über den lesbaren Schlüssel, damit er im Text steht. */
export const IssueLinkChip = createChip({
  name: "issueLink",
  attrs: { id: null, identifier: "" },
  className: chip.issueLink,
  label: (a) => String(a.identifier ?? ""),
});

/**
 * Ein Datum. Gespeichert wird ISO, angezeigt die lokale Schreibweise — so
 * bleibt der Wert eindeutig und die Anzeige trotzdem lesbar.
 */
export const DateChip = createChip({
  name: "dateChip",
  attrs: { date: "" },
  className: chip.dateChip,
  label: (a) => {
    const iso = String(a.date ?? "");
    const parsed = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return iso;
    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  },
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
