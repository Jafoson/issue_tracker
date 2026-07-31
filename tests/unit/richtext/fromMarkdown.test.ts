import { describe, expect, test } from "bun:test";
import { fromMarkdown } from "@/lib/richtext/fromMarkdown";
import type { PMNode } from "@/lib/richtext/types";

/**
 * Die Umwandlung, über die sowohl der Seed als auch die einmalige Migration
 * der Bestandsdaten laufen. Geprüft wird an denselben Konstrukten, die der
 * abgelöste Markdown-Editor erzeugen konnte — was Leute vorher geschrieben
 * haben, muss danach dastehen.
 */

const blocks = (source: string): PMNode[] => fromMarkdown(source).content ?? [];
const first = (source: string): PMNode => blocks(source)[0];

/** Sammelt den Text eines Teilbaums, ohne die Auszeichnungen. */
function text(node: PMNode): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(text).join("");
}

describe("fromMarkdown", () => {
  test("macht aus leerem Text ein leeres Dokument mit einem Absatz", () => {
    expect(fromMarkdown("")).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
    expect(fromMarkdown("   \n  ")).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });

  test("erkennt Überschriften an der Anzahl der Rauten", () => {
    expect(first("# Eins")).toMatchObject({
      type: "heading",
      attrs: { level: 1 },
    });
    expect(first("### Drei")).toMatchObject({
      type: "heading",
      attrs: { level: 3 },
    });
    // Ohne Leerzeichen ist es keine Überschrift, sondern Text.
    expect(first("#kein Titel")).toMatchObject({ type: "paragraph" });
  });

  test("erkennt die Auszeichnungen im Absatz", () => {
    const marks = (source: string) =>
      (first(source).content ?? []).flatMap((n) =>
        (n.marks ?? []).map((m) => m.type),
      );

    expect(marks("Ein **fetter** Text")).toContain("bold");
    expect(marks("Ein __fetter__ Text")).toContain("bold");
    expect(marks("Ein *kursiver* Text")).toContain("italic");
    expect(marks("Ein _kursiver_ Text")).toContain("italic");
    expect(marks("Ein ~~alter~~ Text")).toContain("strike");
    expect(marks("Ein `Code` Text")).toContain("code");
  });

  test("schachtelt Auszeichnungen ineinander", () => {
    const node = first("**fett und *kursiv* zugleich**");
    const nested = (node.content ?? []).find((n) =>
      (n.marks ?? []).some((m) => m.type === "italic"),
    );
    expect(nested?.marks?.map((m) => m.type).sort()).toEqual([
      "bold",
      "italic",
    ]);
  });

  test("macht aus einzelnen Umbrüchen harte Zeilenumbrüche", () => {
    // Der alte Renderer hat sie über `pre-wrap` sichtbar gelassen.
    const node = first("Erste Zeile\nZweite Zeile");
    expect(node.content?.some((n) => n.type === "hardBreak")).toBe(true);
    expect(blocks("Erste\n\nZweite")).toHaveLength(2);
  });

  test("erkennt beide Listenarten", () => {
    expect(first("- eins\n- zwei")).toMatchObject({ type: "bulletList" });
    expect(first("1. eins\n2. zwei")).toMatchObject({ type: "orderedList" });
    expect(first("- eins\n- zwei").content).toHaveLength(2);
  });

  test("erkennt Checklisten samt Zustand", () => {
    const list = first("- [ ] offen\n- [x] erledigt");
    expect(list.type).toBe("taskList");
    expect(list.content?.[0]).toMatchObject({ attrs: { checked: false } });
    expect(list.content?.[1]).toMatchObject({ attrs: { checked: true } });
    expect(text(list)).toBe("offenerledigt");
  });

  test("hält Checkliste und einfache Aufzählung auseinander", () => {
    const result = blocks("- normal\n- [ ] eine Aufgabe");
    expect(result.map((b) => b.type)).toEqual(["bulletList", "taskList"]);
  });

  test("erkennt Zitat, Codeblock und Trennlinie", () => {
    expect(first("> zitiert")).toMatchObject({ type: "blockquote" });

    const code = first("```ts\nconst a = 1\n```");
    expect(code).toMatchObject({
      type: "codeBlock",
      attrs: { language: "ts" },
    });
    expect(text(code)).toBe("const a = 1");

    expect(first("---")).toMatchObject({ type: "horizontalRule" });
  });

  test("macht aus Links einen Textknoten mit Link-Mark", () => {
    const node = first("[Orbit](https://example.com)");
    const link = node.content?.[0];
    expect(link?.marks?.[0]).toMatchObject({
      type: "link",
      attrs: { href: "https://example.com" },
    });
    expect(text(node)).toBe("Orbit");
  });

  test("erkennt nackte Adressen", () => {
    const node = first("Siehe https://example.com dort");
    expect(
      node.content?.some((n) => (n.marks ?? []).some((m) => m.type === "link")),
    ).toBe(true);
  });

  test("macht aus Bildern einen eigenen Knoten", () => {
    const node = first("![Alt-Text](/bild.png)");
    expect(node.content?.[0]).toMatchObject({
      type: "image",
      attrs: { src: "/bild.png", alt: "Alt-Text" },
    });
  });

  test("lässt gefährliche Adressen als Text stehen", () => {
    const node = first("[klick](javascript:alert(1))");
    // Kein Link-Mark, kein Bild — nur der ursprüngliche Text.
    expect(node.content?.some((n) => (n.marks ?? []).length > 0)).toBe(false);
    expect(text(node)).toContain("klick");
  });

  test("trennt aufeinanderfolgende Blöcke ohne Leerzeile", () => {
    const result = blocks("# Titel\n- eins\n> zitat");
    expect(result.map((b) => b.type)).toEqual([
      "heading",
      "bulletList",
      "blockquote",
    ]);
  });

  test("erzeugt Absätze ohne leeres content-Array", () => {
    // ProseMirror lehnt `content: []` ab — ein leerer Absatz hat gar kein Feld.
    const node = fromMarkdown("");
    expect(node.content?.[0]).not.toHaveProperty("content");
  });
});
