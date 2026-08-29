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

describe("Auslöser / und //", () => {
  test("ein einzelner Schrägstrich öffnet das Befehlsmenü", () => {
    expect(matchAtEnd("/", "/")).not.toBeNull();
    expect(matchAtEnd("/tab", "/")?.query).toBe("tab");
  });

  test("der zweite Schrägstrich schließt das Befehlsmenü", () => {
    // The character right before the match is a `/`, which isn't in
    // `allowedPrefixes`. That's exactly what keeps both triggers from
    // matching at the same time.
    expect(matchAtEnd("//", "/")).toBeNull();
    expect(matchAtEnd("//1.2.2002", "/")).toBeNull();
  });

  test("`//` löst den Datums-Auslöser aus", () => {
    expect(matchAtEnd("//", "//")).not.toBeNull();
    expect(matchAtEnd("//", "//")?.query).toBe("");
  });

  test("hinter `//` steht die Eingabe als Suchtext", () => {
    expect(matchAtEnd("//now", "//")?.query).toBe("now");
    expect(matchAtEnd("//1.2.2002", "//")?.query).toBe("1.2.2002");
    expect(matchAtEnd("//2026-08-14", "//")?.query).toBe("2026-08-14");
  });

  test("greift auch mitten im Satz — aber nur nach einem Leerzeichen", () => {
    expect(matchAtEnd("Fällig am //", "//")).not.toBeNull();
    // Stuck directly onto a word, it's not a trigger — just text.
    expect(matchAtEnd("http://", "//")).toBeNull();
  });

  test("ein einzelner Schrägstrich löst den Datums-Auslöser nicht aus", () => {
    expect(matchAtEnd("/", "//")).toBeNull();
    expect(matchAtEnd("/tab", "//")).toBeNull();
  });
});
