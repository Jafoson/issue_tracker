import { type Editor, Extension, type Range } from "@tiptap/core";
import { Suggestion, type SuggestionOptions } from "@tiptap/suggestion";
import type { SuggestionItem } from "../components/SuggestionMenu/SuggestionMenu";

/**
 * The `/` menu.
 *
 * Unlike the chips, it doesn't insert its own node — it runs a command on
 * the editor. Which commands those are isn't decided here: the list is built
 * in `RichTextEditor`, because it needs translated names and icons. This
 * extension only knows the trigger.
 */

export interface SlashCommandItem extends SuggestionItem {
  /** What happens when the entry is selected. */
  run: (props: { editor: Editor; range: Range }) => void;
  /**
   * Additional words the entry can be found by — the label, after all, only
   * appears in whichever language is currently set.
   *
   * Each entry carries the German and the English term as well as common
   * short forms, so `/trennlinie`, `/divider`, and `/hr` all find the same
   * thing.
   */
  keywords?: string[];
}

export interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions<SlashCommandItem>, "editor"> | null;
}

/**
 * Lowercased with diacritics stripped — so `/uberschrift` also matches
 * "Überschrift" and `/aufzahlung` matches "Aufzählung". Someone searching
 * rarely types umlauts.
 */
export function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * The matches for the input in the `/` menu.
 *
 * Searched by label, id, **and** keywords: the label only appears in
 * whichever language is set, while the keywords let `/trennlinie` find the
 * same thing as `/divider`.
 *
 * Without input, the list stays as it is — groups included. As soon as
 * there's a search, the group headings drop away: the ranking mixes up
 * entries from different groups, and the same heading would otherwise show
 * up multiple times in the list.
 */
export function filterSlashItems(
  items: SlashCommandItem[],
  query: string,
): SlashCommandItem[] {
  const q = normalize(query);
  if (!q) return items;

  const termsOf = (item: SlashCommandItem) =>
    [item.label, item.id, ...(item.keywords ?? [])].map(normalize);

  return (
    items
      .map((item) => ({ item, terms: termsOf(item) }))
      .filter(({ terms }) => terms.some((term) => term.includes(q)))
      // Matches at the start of a word come first: someone typing `/ta`
      // means "Table", not "Numbered list" (which carries the `ta` in the
      // middle). `sort` is stable, so within each rank the given order is
      // preserved.
      .sort(
        (a, b) =>
          Number(!a.terms.some((t) => t.startsWith(q))) -
          Number(!b.terms.some((t) => t.startsWith(q))),
      )
      .map(({ item }) => ({ ...item, group: undefined }))
  );
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addOptions() {
    return { suggestion: null };
  },

  addProseMirrorPlugins() {
    const { suggestion } = this.options;
    if (!suggestion) return [];
    return [Suggestion({ editor: this.editor, ...suggestion })];
  },
});
