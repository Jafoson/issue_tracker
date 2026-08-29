import { mergeAttributes, Node } from "@tiptap/core";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import { Suggestion, type SuggestionOptions } from "@tiptap/suggestion";
import { formatChipDate } from "@/lib/richtext/date";
import { faviconStyle, hostOf } from "@/lib/richtext/link";
// Same classes as in the display path: the `Chip` atom provides the shape,
// the rich-text styles provide the symbol before it. A chip must look the
// same while writing as it does afterward while reading, otherwise the text
// jumps when saved.
//
// Only the classes, not the component — `renderHTML` builds plain DOM,
// there's no React here.
import atom from "../../../atoms/Chip/chip.module.scss";
import chip from "../../../atoms/RichText/richText.module.scss";
import type { SuggestionItem } from "../components/SuggestionMenu/SuggestionMenu";

/** What `<Chip as="span" size="inline" variant="elevated">` produces. */
const CHIP_CLASS = [atom.chip, atom.elevated, atom.inline].join(" ");

/** The same, with a symbol in the icon slot before it. */
const CHIP_CLASS_ICON = `${CHIP_CLASS} ${atom.hasIcon}`;

/**
 * The four inline chips: mention, issue, date, and emoji.
 *
 * All four are inline atoms — a single character in the document that
 * carries its content in its attributes and can't be edited from within.
 * That's exactly why they're grouped together here: they only differ in
 * their attributes and their label.
 *
 * The attributes go into HTML as `data-*`, so copying and pasting between
 * two editors preserves the chip instead of breaking it down into text.
 *
 * Which trigger opens a chip isn't decided here: the editor passes that in
 * via `.configure({ suggestion })`, because the data behind it is
 * domain-specific (members, issues) and `components/ui` shouldn't know
 * anything about that.
 */

export interface ChipOptions {
  suggestion: Omit<SuggestionOptions<SuggestionItem>, "editor"> | null;
}

interface ChipConfig {
  name: string;
  /** Attribute names along with their default value. */
  attrs: Record<string, string | null>;
  className?: string;
  /** What's displayed inside the chip. */
  label: (attrs: Record<string, unknown>) => string;
  /**
   * A piece before the text — the mention's avatar. The hash and calendar
   * chips don't need this: those exist as a mask in CSS and thus apply
   * equally to the editor and the display path.
   */
  lead?: (attrs: Record<string, unknown>) => DOMOutputSpec | null;
  /** Extra class on the label — the fixed-width font for the issue chip. */
  labelClass?: string;
  /** What appears on hover — the link chip's address. */
  titleOf?: (attrs: Record<string, unknown>) => string | undefined;
  /**
   * The plain-text form — for copying and for `editor.getText()`. Falls
   * back to `label` if not given; the mention chip prepends its `@` here,
   * which would be redundant inside the chip itself.
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

      // Without a chip wrapper (the emoji), it stays a bare character — the
      // atom's slots would have nothing to hold there.
      if (!className) return ["span", attributes, label(node.attrs)];

      const before = lead?.(node.attrs);
      return [
        "span",
        attributes,
        // Same slots as in the atom: symbol first, then the label.
        ...(before ? [["span", { class: atom.icon }, before]] : []),
        [
          "span",
          { class: [atom.label, labelClass].filter(Boolean).join(" ") },
          label(node.attrs),
        ],
      ] as DOMOutputSpec;
    },

    /** For copying as plain text and for `editor.getText()`. */
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
 * A mentioned member: `@` and the name.
 *
 * The `@` sits in the text rather than in its own slot — that way it
 * naturally carries the text's baseline and gets copied along when
 * selected.
 */
export const MentionChip = createChip({
  name: "mention",
  attrs: { id: null, label: "" },
  className: CHIP_CLASS,
  label: (a) => `@${a.label ?? ""}`,
});

/** `ORB-42` — references via the readable key, so it appears in the text. */
export const IssueLinkChip = createChip({
  name: "issueLink",
  attrs: { id: null, identifier: "" },
  className: CHIP_CLASS_ICON,
  label: (a) => String(a.identifier ?? ""),
  labelClass: chip.issueLinkLabel,
  lead: () => ["span", { class: chip.issueIcon, "aria-hidden": "true" }],
});

/**
 * A link to an external page.
 *
 * No attribute beyond address and name: the icon derives from the address,
 * and a separately stored path would only go stale.
 */
export const LinkChip = createChip({
  name: "linkChip",
  attrs: { href: "", label: "" },
  className: CHIP_CLASS_ICON,
  // Without a name, the hostname is shown — better than a bare, long address.
  label: (a) => String(a.label || hostOf(String(a.href ?? ""))),
  text: (a) => String(a.href ?? ""),
  // The chip shows the name — the address behind it appears on hover.
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
 * A date. Stored as ISO, displayed in the local format — that way the
 * value stays unambiguous while the display remains readable.
 */
export const DateChip = createChip({
  name: "dateChip",
  attrs: { date: "" },
  className: CHIP_CLASS_ICON,
  label: (a) => formatChipDate(String(a.date ?? "")),
  lead: () => ["span", { class: chip.dateIcon, "aria-hidden": "true" }],
});

/**
 * Emoji as its own node rather than a character in the text: that way the
 * short name is preserved, and `toPlainText` can carry it along for search.
 * No class of its own — an emoji needs no chip border.
 */
export const EmojiChip = createChip({
  name: "emoji",
  attrs: { name: "", emoji: "" },
  label: (a) => String(a.emoji ?? ""),
});
