import { type Editor, Extension, type Range } from "@tiptap/core";
import { Suggestion, type SuggestionOptions } from "@tiptap/suggestion";
import type { SuggestionItem } from "../components/SuggestionMenu/SuggestionMenu";

/**
 * Das `/`-Menü.
 *
 * Anders als die Chips fügt es keinen eigenen Knoten ein — es führt einen
 * Befehl auf dem Editor aus. Welche Befehle das sind, steht nicht hier: die
 * Liste wird im `RichTextEditor` gebaut, weil sie übersetzte Namen und Icons
 * braucht. Diese Erweiterung kennt nur den Auslöser.
 */

export interface SlashCommandItem extends SuggestionItem {
  /** Was passiert, wenn der Eintrag gewählt wird. */
  run: (props: { editor: Editor; range: Range }) => void;
  /**
   * Weitere Wörter, über die der Eintrag zu finden ist — die Beschriftung
   * steht ja nur in der gerade eingestellten Sprache da.
   *
   * Enthält jeweils den deutschen und den englischen Begriff sowie gängige
   * Kurzformen, sodass `/trennlinie`, `/divider` und `/hr` dasselbe finden.
   */
  keywords?: string[];
}

export interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions<SlashCommandItem>, "editor"> | null;
}

/**
 * Kleinschreibung ohne diakritische Zeichen — damit `/uberschrift` auch
 * „Überschrift" findet und `/aufzahlung` die „Aufzählung". Wer sucht, tippt
 * selten Umlaute.
 */
export function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Die Treffer zur Eingabe im `/`-Menü.
 *
 * Gesucht wird über Beschriftung, Kennung **und** Suchbegriffe: die
 * Beschriftung steht nur in der eingestellten Sprache da, über die Begriffe
 * findet `/trennlinie` dasselbe wie `/divider`.
 *
 * Ohne Eingabe bleibt die Liste, wie sie ist — samt Gruppen. Sobald gesucht
 * wird, fallen die Gruppenköpfe weg: die Rangfolge zieht Einträge aus
 * verschiedenen Gruppen durcheinander, und dieselbe Überschrift stünde sonst
 * mehrfach in der Liste.
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
      // Treffer am Wortanfang zuerst: wer `/ta` tippt, meint „Tabelle", nicht
      // „Nummerierte Liste" (die das `ta` in der Mitte trägt). `sort` ist stabil,
      // innerhalb der Ränge bleibt die übergebene Reihenfolge erhalten.
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
