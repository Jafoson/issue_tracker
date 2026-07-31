import { describe, expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { findSuggestionMatch } from "@tiptap/suggestion";

/**
 * `/` öffnet das Befehlsmenü, `//` den Datums-Auslöser. Zwei Auslöser, von
 * denen der eine mit dem anderen beginnt — die Frage ist, ob sie sich in die
 * Quere kommen.
 *
 * Geprüft am echten Matcher aus `@tiptap/suggestion` statt an einem Nachbau:
 * die Verträglichkeit hängt an dessen Präfix-Regel, und die soll uns auffallen,
 * wenn sie sich ändert.
 */

const schema = getSchema([StarterKit] as never);

/** Sucht am Ende des Texts nach einem Treffer für `char`. */
function matchAtEnd(text: string, char: string) {
  const doc = PMNode.fromJSON(schema, {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
  // Ende des Textknotens: ein Zeichen für den Absatz, dann der Text.
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
    // Der Treffer davor ist ein `/`, und das steht nicht in `allowedPrefixes`.
    // Genau daran hängt, dass nicht beide Listen gleichzeitig aufgehen.
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
    // Direkt an ein Wort geklebt ist es kein Auslöser, sondern Text.
    expect(matchAtEnd("http://", "//")).toBeNull();
  });

  test("ein einzelner Schrägstrich löst den Datums-Auslöser nicht aus", () => {
    expect(matchAtEnd("/", "//")).toBeNull();
    expect(matchAtEnd("/tab", "//")).toBeNull();
  });
});
