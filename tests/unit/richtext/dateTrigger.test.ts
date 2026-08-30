import { describe, expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { findSuggestionMatch } from "@tiptap/suggestion";

/**
 * `/` opens the command menu, `//` the date trigger. Two triggers, one of
 * which begins with the other — the question is whether they get in each
 * other's way.
 *
 * Tested against the real matcher from `@tiptap/suggestion` rather than a
 * reimplementation: compatibility hinges on its prefix rule, and we want to
 * notice if that rule changes.
 */

const schema = getSchema([StarterKit] as never);

/** Looks for a match for `char` at the end of the text. */
function matchAtEnd(text: string, char: string) {
  const doc = PMNode.fromJSON(schema, {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
  // End of the text node: one character for the paragraph, then the text.
  const $position = doc.resolve(1 + text.length);

  return findSuggestionMatch({
    char,
    allowSpaces: false,
    allowToIncludeChar: false,
    allowedPrefixes: [" "],
    startOfLine: false,
    $position,
  });
}

describe("Trigger / and //", () => {
  test("a single slash opens the command menu", () => {
    expect(matchAtEnd("/", "/")).not.toBeNull();
    expect(matchAtEnd("/tab", "/")?.query).toBe("tab");
  });

  test("the second slash closes the command menu", () => {
    // The character right before the match is a `/`, which isn't in
    // `allowedPrefixes`. That's exactly what keeps both triggers from
    // matching at the same time.
    expect(matchAtEnd("//", "/")).toBeNull();
    expect(matchAtEnd("//1.2.2002", "/")).toBeNull();
  });

  test("`//` triggers the date trigger", () => {
    expect(matchAtEnd("//", "//")).not.toBeNull();
    expect(matchAtEnd("//", "//")?.query).toBe("");
  });

  test("the input after `//` is used as the search text", () => {
    expect(matchAtEnd("//now", "//")?.query).toBe("now");
    expect(matchAtEnd("//1.2.2002", "//")?.query).toBe("1.2.2002");
    expect(matchAtEnd("//2026-08-14", "//")?.query).toBe("2026-08-14");
  });

  test("also works mid-sentence — but only after a space", () => {
    expect(matchAtEnd("Fällig am //", "//")).not.toBeNull();
    // Stuck directly onto a word, it's not a trigger — just text.
    expect(matchAtEnd("http://", "//")).toBeNull();
  });

  test("a single slash does not trigger the date trigger", () => {
    expect(matchAtEnd("/", "//")).toBeNull();
    expect(matchAtEnd("/tab", "//")).toBeNull();
  });
});
