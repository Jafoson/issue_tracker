import { describe, expect, test } from "bun:test";
import type { SuggestionItem } from "@/components/ui/layout/RichTextEditor/components/SuggestionMenu/SuggestionMenu";
import { createSuggestion } from "@/components/ui/layout/RichTextEditor/extensions/suggestion";

/**
 * Der Editor selbst lässt sich hier nicht bauen — ProseMirror braucht ein echtes
 * DOM. Die Bedingung, an der er zerbrochen ist, lässt sich aber ohne DOM prüfen:
 *
 * `@tiptap/suggestion` legt seinen Plugin-Schlüssel modulweit **einmal** an. Wer
 * mehrere Trigger registriert, ohne eigene Schlüssel zu vergeben, bekommt vier
 * verschiedene Plugins unter demselben Schlüssel — und ProseMirror wirft beim
 * Erzeugen des Editors `RangeError: Adding different instances of a keyed plugin`.
 *
 * Genau das ist passiert. Deshalb steht die Bedingung hier fest.
 */

const make = (name: string) =>
  createSuggestion<SuggestionItem>({
    name,
    char: "@",
    items: () => [],
    onSelect: () => {},
    emptyLabel: () => "",
  });

/** Der Name, unter dem ProseMirror den Schlüssel führt. */
const keyName = (key: unknown) => (key as { key: string }).key;

describe("createSuggestion", () => {
  test("vergibt überhaupt einen eigenen Plugin-Schlüssel", () => {
    // Ohne diesen Schlüssel gälte der modulweite Standard aus @tiptap/suggestion.
    expect(make("mentionSuggestion").pluginKey).toBeDefined();
  });

  test("gibt zwei Triggern niemals denselben Schlüssel", () => {
    const a = make("mentionSuggestion");
    const b = make("issueLinkSuggestion");

    expect(a.pluginKey).not.toBe(b.pluginKey);
    expect(keyName(a.pluginKey)).not.toBe(keyName(b.pluginKey));
  });

  test("hält alle vier Trigger des Editors auseinander", () => {
    // Dieselben Namen wie in `RichTextEditor` — vier Plugins in einem Editor.
    const names = [
      "mentionSuggestion",
      "issueLinkSuggestion",
      "emojiSuggestion",
      "slashCommand",
    ];
    const keys = names.map((n) => keyName(make(n).pluginKey));

    expect(new Set(keys).size).toBe(names.length);
  });

  test("übernimmt den Namen in den Schlüssel — für lesbare Fehlermeldungen", () => {
    expect(keyName(make("mentionSuggestion").pluginKey)).toStartWith(
      "mentionSuggestion",
    );
  });

  test("reicht die Trigger-Optionen unverändert durch", () => {
    const suggestion = createSuggestion<SuggestionItem>({
      name: "test",
      char: "#",
      allowSpaces: true,
      startOfLine: true,
      items: () => [],
      onSelect: () => {},
      emptyLabel: () => "",
    });

    expect(suggestion.char).toBe("#");
    expect(suggestion.allowSpaces).toBe(true);
    expect(suggestion.startOfLine).toBe(true);
  });
});
