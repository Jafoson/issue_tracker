import { describe, expect, test } from "bun:test";
import { CODE_LANGUAGES } from "@/lib/richtext/code";
import {
  detectLanguage,
  highlightLines,
  lowlight,
} from "@/lib/richtext/highlight";

/**
 * Syntax highlighting. Tested at the points where it's interlocked with the
 * rest of the system: the language list and the line-splitting for the
 * line numbers.
 */

/** All classes of a line, concatenated for simplicity. */
const classesOf = (code: string, lang: string) =>
  highlightLines(code, lang)
    .flat()
    .map((t) => t.className)
    .filter(Boolean)
    .join(" ");

describe("lowlight instance", () => {
  test("knows every language in the selection list", () => {
    // Otherwise a language would show up in the menu that highlights nothing.
    const fehlend = CODE_LANGUAGES.filter(
      (l) => !lowlight.registered(l.value),
    ).map((l) => l.value);
    expect(fehlend).toEqual([]);
  });

  test("registers only these — not the nearly two hundred from highlight.js", () => {
    expect(lowlight.listLanguages().length).toBe(CODE_LANGUAGES.length);
  });
});

describe("highlightLines", () => {
  test("recognizes the usual token roles", () => {
    const ts = classesOf('const a = "hallo" // hi', "ts");
    expect(ts).toContain("hljs-keyword");
    expect(ts).toContain("hljs-string");
    expect(ts).toContain("hljs-comment");
  });

  test("finds the language even via an alternate spelling", () => {
    // `py` and `python` must highlight the same way.
    expect(classesOf("def f(): pass", "py")).toBe(
      classesOf("def f(): pass", "python"),
    );
  });

  test("returns one entry per line", () => {
    expect(highlightLines("eins\nzwei\ndrei", null)).toHaveLength(3);
    expect(highlightLines("const a = 1\nconst b = 2", "ts")).toHaveLength(2);
  });

  test("does not count a trailing line break as another line", () => {
    expect(highlightLines("eins\nzwei\n", null)).toHaveLength(2);
  });

  test("keeps empty lines — their line number should remain", () => {
    const lines = highlightLines("eins\n\ndrei", "ts");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual([]);
  });

  test("splits a token that spans a line break", () => {
    // A block comment is a single token spanning multiple lines — both
    // halves need to keep their role, otherwise the second one loses its color.
    const lines = highlightLines("/* eins\n   zwei */", "ts");
    expect(lines).toHaveLength(2);
    expect(lines[0][0].className).toContain("hljs-comment");
    expect(lines[1][0].className).toContain("hljs-comment");
  });

  test("reassembles the text unchanged", () => {
    // Nothing may get lost while splitting apart.
    const code = 'function f(x) {\n  return "a" + x; // hm\n}';
    const wieder = highlightLines(code, "ts")
      .map((line) => line.map((t) => t.text).join(""))
      .join("\n");
    expect(wieder).toBe(code);
  });

  test("leaves text without a language alone", () => {
    // Deliberately no guessing: a guess would look different every time.
    expect(highlightLines("beliebiger text", null)).toEqual([
      [{ text: "beliebiger text" }],
    ]);
    expect(highlightLines("x", "gibtsnicht")).toEqual([[{ text: "x" }]]);
  });
});

describe("detectLanguage", () => {
  test("recognizes the common languages", () => {
    const proben: [string, string][] = [
      [
        "ts",
        "export function add(a: number, b: number): number {\n  return a + b;\n}",
      ],
      [
        "python",
        'def add(a, b):\n    """Summe."""\n    return a + b\n\nprint(add(1, 2))',
      ],
      [
        "sql",
        "SELECT id, title FROM issues\nWHERE status = 'open'\nORDER BY created DESC;",
      ],
      [
        "css",
        ".panel {\n  display: flex;\n  border-radius: 8px;\n  background: var(--surface);\n}",
      ],
      [
        "json",
        '{\n  "name": "orbit",\n  "version": "0.1.0",\n  "private": true\n}',
      ],
      [
        "go",
        'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hi")\n}',
      ],
    ];
    for (const [erwartet, code] of proben) {
      expect(detectLanguage(code)).toBe(erwartet);
    }
  });

  test("does not guess when there is too little text", () => {
    // Three words fit a dozen languages.
    expect(detectLanguage("const a = 1")).toBeNull();
    expect(detectLanguage("x")).toBeNull();
    expect(detectLanguage("")).toBeNull();
  });

  test("leaves prose alone", () => {
    // `highlight.js` always crowns a winner — here with a score of 1, which
    // stays below the threshold. Without that, every plain prose text would
    // be called "CSS".
    expect(
      detectLanguage(
        "Das ist einfach ein Satz.\nUnd noch einer dazu, ohne jeden Code darin.",
      ),
    ).toBeNull();
    expect(
      detectLanguage(
        "Hallo Welt, wie geht es dir heute?\nMir geht es gut, danke der Nachfrage.",
      ),
    ).toBeNull();
  });

  test("only returns values the selection list knows", () => {
    // Otherwise the block would end up tagged with a value the menu can't display.
    const bekannt = CODE_LANGUAGES.map((l) => l.value);
    const proben = [
      "export const a = 1;\nexport const b = 2;\nconsole.log(a + b);",
      "SELECT * FROM t\nWHERE x = 1\nGROUP BY y;",
      "# Titel\n\nEin Absatz mit **fett** und `code` darin.",
      "Das ist Prosa und keine Sprache, nur ein paar Sätze hintereinander.",
    ];
    for (const code of proben) {
      const erkannt = detectLanguage(code);
      // Either nothing — or something the list knows.
      if (erkannt !== null) expect(bekannt).toContain(erkannt);
    }
  });

  test("discards a weak match instead of mislabeling it", () => {
    // `highlight.js` guesses short Python without distinctive features as
    // "css" with a score of 4 — below the threshold. Better plain than wrong.
    expect(
      detectLanguage("def add(a, b):\n    return a + b\n\nprint(add(1, 2))"),
    ).toBeNull();
  });
});
