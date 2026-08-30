import { describe, expect, test } from "bun:test";
import type { SuggestionItem } from "@/components/ui/layout/RichTextEditor/components/SuggestionMenu/SuggestionMenu";
import { createSuggestion } from "@/components/ui/layout/RichTextEditor/extensions/suggestion";

/**
 * The editor itself can't be built here — ProseMirror needs a real DOM. But
 * the condition that broke it can be checked without a DOM:
 *
 * `@tiptap/suggestion` creates its plugin key **once**, module-wide. Anyone
 * registering multiple triggers without assigning their own keys ends up
 * with four different plugins under the same key — and ProseMirror throws
 * `RangeError: Adding different instances of a keyed plugin` when creating
 * the editor.
 *
 * That's exactly what happened. That's why this condition is pinned down here.
 */

const make = (name: string) =>
  createSuggestion<SuggestionItem>({
    name,
    char: "@",
    items: () => [],
    onSelect: () => {},
    emptyLabel: () => "",
  });

/** The name under which ProseMirror keeps the key. */
const keyName = (key: unknown) => (key as { key: string }).key;

describe("createSuggestion", () => {
  test("assigns its own plugin key at all", () => {
    // Without this key, the module-wide default from @tiptap/suggestion would apply.
    expect(make("mentionSuggestion").pluginKey).toBeDefined();
  });

  test("never gives two triggers the same key", () => {
    const a = make("mentionSuggestion");
    const b = make("issueLinkSuggestion");

    expect(a.pluginKey).not.toBe(b.pluginKey);
    expect(keyName(a.pluginKey)).not.toBe(keyName(b.pluginKey));
  });

  test("keeps all four of the editor's triggers apart", () => {
    // The same names as in `RichTextEditor` — four plugins in one editor.
    const names = [
      "mentionSuggestion",
      "issueLinkSuggestion",
      "emojiSuggestion",
      "slashCommand",
    ];
    const keys = names.map((n) => keyName(make(n).pluginKey));

    expect(new Set(keys).size).toBe(names.length);
  });

  test("carries the name into the key — for readable error messages", () => {
    expect(keyName(make("mentionSuggestion").pluginKey)).toStartWith(
      "mentionSuggestion",
    );
  });

  test("passes the trigger options through unchanged", () => {
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
