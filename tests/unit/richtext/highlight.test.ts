import { describe, expect, test } from "bun:test";
import { CODE_LANGUAGES } from "@/lib/richtext/code";
import {
  detectLanguage,
  highlightLines,
  lowlight,
} from "@/lib/richtext/highlight";

/**
 * Die Syntax-Hervorhebung. Geprüft wird an den Stellen, an denen sie mit dem
 * Rest verzahnt ist: der Sprachliste und der Zeilenaufteilung für die Nummern.
 */

/** Alle Klassen einer Zeile, der Einfachheit halber zusammengezogen. */
const classesOf = (code: string, lang: string) =>
  highlightLines(code, lang)
    .flat()
    .map((t) => t.className)
    .filter(Boolean)
    .join(" ");

describe("lowlight-Instanz", () => {
  test("kennt jede Sprache aus der Auswahlliste", () => {
    // Sonst stünde eine Sprache im Menü, die nichts einfärbt.
    const fehlend = CODE_LANGUAGES.filter(
      (l) => !lowlight.registered(l.value),
    ).map((l) => l.value);
    expect(fehlend).toEqual([]);
  });

  test("registriert nur diese — nicht die knapp zweihundert von highlight.js", () => {
    expect(lowlight.listLanguages().length).toBe(CODE_LANGUAGES.length);
  });
});

describe("highlightLines", () => {
  test("erkennt die üblichen Rollen", () => {
    const ts = classesOf('const a = "hallo" // hi', "ts");
    expect(ts).toContain("hljs-keyword");
    expect(ts).toContain("hljs-string");
    expect(ts).toContain("hljs-comment");
  });

  test("findet die Sprache auch über eine andere Schreibweise", () => {
    // `py` und `python` müssen dasselbe färben.
    expect(classesOf("def f(): pass", "py")).toBe(
      classesOf("def f(): pass", "python"),
    );
  });

  test("gibt eine Zeile je Zeile zurück", () => {
    expect(highlightLines("eins\nzwei\ndrei", null)).toHaveLength(3);
    expect(highlightLines("const a = 1\nconst b = 2", "ts")).toHaveLength(2);
  });

  test("zählt einen abschließenden Umbruch nicht als weitere Zeile", () => {
    expect(highlightLines("eins\nzwei\n", null)).toHaveLength(2);
  });

  test("behält leere Zeilen — ihre Nummer soll stehen bleiben", () => {
    const lines = highlightLines("eins\n\ndrei", "ts");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual([]);
  });

  test("teilt ein Stück, das über einen Umbruch geht", () => {
    // Ein Blockkommentar ist ein Token über mehrere Zeilen — beide Hälften
    // müssen ihre Rolle behalten, sonst verliert die zweite ihre Farbe.
    const lines = highlightLines("/* eins\n   zwei */", "ts");
    expect(lines).toHaveLength(2);
    expect(lines[0][0].className).toContain("hljs-comment");
    expect(lines[1][0].className).toContain("hljs-comment");
  });

  test("setzt den Text unverändert wieder zusammen", () => {
    // Nichts darf beim Zerlegen verlorengehen.
    const code = 'function f(x) {\n  return "a" + x; // hm\n}';
    const wieder = highlightLines(code, "ts")
      .map((line) => line.map((t) => t.text).join(""))
      .join("\n");
    expect(wieder).toBe(code);
  });

  test("lässt Text ohne Sprache in Ruhe", () => {
    // Bewusst kein Raten: geraten sähe mal so und mal so aus.
    expect(highlightLines("beliebiger text", null)).toEqual([
      [{ text: "beliebiger text" }],
    ]);
    expect(highlightLines("x", "gibtsnicht")).toEqual([[{ text: "x" }]]);
  });
});

describe("detectLanguage", () => {
  test("erkennt die üblichen Sprachen", () => {
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

  test("rät nicht bei zu wenig Text", () => {
    // Drei Wörter passen auf ein Dutzend Sprachen.
    expect(detectLanguage("const a = 1")).toBeNull();
    expect(detectLanguage("x")).toBeNull();
    expect(detectLanguage("")).toBeNull();
  });

  test("lässt Prosa in Ruhe", () => {
    // `highlight.js` kürt immer einen Sieger — hier mit einer Bewertung von 1,
    // die unter der Schwelle bleibt. Ohne sie hieße jeder Fließtext „CSS".
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

  test("liefert nur Werte, die die Auswahlliste kennt", () => {
    // Sonst stünde am Block eine Angabe, die das Menü nicht anzeigen kann.
    const bekannt = CODE_LANGUAGES.map((l) => l.value);
    const proben = [
      "export const a = 1;\nexport const b = 2;\nconsole.log(a + b);",
      "SELECT * FROM t\nWHERE x = 1\nGROUP BY y;",
      "# Titel\n\nEin Absatz mit **fett** und `code` darin.",
      "Das ist Prosa und keine Sprache, nur ein paar Sätze hintereinander.",
    ];
    for (const code of proben) {
      const erkannt = detectLanguage(code);
      // Entweder nichts — oder etwas, das die Liste kennt.
      if (erkannt !== null) expect(bekannt).toContain(erkannt);
    }
  });

  test("verwirft einen schwachen Treffer, statt falsch zu beschriften", () => {
    // Kurzes Python ohne auffällige Merkmale rät `highlight.js` als „css" mit
    // Bewertung 4 — unter der Schwelle. Lieber schlicht als falsch.
    expect(
      detectLanguage("def add(a, b):\n    return a + b\n\nprint(add(1, 2))"),
    ).toBeNull();
  });
});
