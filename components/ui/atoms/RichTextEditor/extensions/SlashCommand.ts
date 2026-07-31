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
}

export interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions<SlashCommandItem>, "editor"> | null;
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
