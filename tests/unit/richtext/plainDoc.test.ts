import { describe, expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { MentionChip } from "@/components/ui/layout/RichTextEditor/extensions/chips";
import { toPlainDoc } from "@/lib/richtext/doc";
import type { PMDoc } from "@/lib/richtext/types";

/**
 * Die Falle, in die der Editor gelaufen ist:
 *
 * ProseMirror legt Knoten-Attribute mit `Object.create(null)` an, und
 * `toJSON()` gibt genau dieses Objekt heraus. React lehnt Objekte ohne
 * Prototyp beim Übergang zu einer Server Function ab (`isSimpleObject` prüft
 * die Prototypenkette) und schiebt statt der Daten eine temporäre Referenz
 * hinüber — serverseitig bricht dann jeder Zugriff darauf ab.
 *
 * Der Test geht durch das echte ProseMirror, nicht durch einen Nachbau: nur so
 * bleibt er gültig, wenn sich deren Interna ändern.
 */

const schema = getSchema([StarterKit, MentionChip] as never);

/** Ein Dokument so, wie `editor.getJSON()` es liefert. */
function fromEditor(): PMDoc {
  return PMNode.fromJSON(schema, {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Ziel" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "mention", attrs: { id: "u1", label: "Anna Weber" } },
        ],
      },
    ],
  }).toJSON() as PMDoc;
}

/** Alle `attrs` im Baum einsammeln. */
function allAttrs(doc: PMDoc): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const walk = (node: { attrs?: unknown; content?: unknown[] }) => {
    if (node.attrs) found.push(node.attrs as Record<string, unknown>);
    (node.content as typeof found | undefined)?.forEach(walk);
  };
  (doc.content ?? []).forEach(walk);
  return found;
}

describe("toPlainDoc", () => {
  test("ProseMirror liefert Attribute ohne Prototyp — die Annahme des Tests", () => {
    const attrs = allAttrs(fromEditor());
    expect(attrs.length).toBeGreaterThan(0);
    // Genau das lehnt React beim Übergang zum Server ab.
    expect(attrs.every((a) => Object.getPrototypeOf(a) === null)).toBe(true);
  });

  test("macht daraus Objekte mit gewöhnlichem Prototyp", () => {
    const attrs = allAttrs(toPlainDoc(fromEditor()));
    expect(attrs.length).toBeGreaterThan(0);
    expect(
      attrs.every((a) => Object.getPrototypeOf(a) === Object.prototype),
    ).toBe(true);
  });

  test("lässt den Inhalt dabei unangetastet", () => {
    const plain = toPlainDoc(fromEditor());
    // Werte identisch — nur die Prototypen sind andere.
    expect(JSON.stringify(plain)).toBe(JSON.stringify(fromEditor()));
    expect(plain.content?.[0]).toMatchObject({
      type: "heading",
      attrs: { level: 2 },
    });
    expect(plain.content?.[1]?.content?.[0]).toMatchObject({
      type: "mention",
      attrs: { id: "u1", label: "Anna Weber" },
    });
  });

  test("erfasst auch tief verschachtelte Attribute", () => {
    const doc = PMNode.fromJSON(schema, {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "mention",
                          attrs: { id: "u2", label: "Ben" },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }).toJSON() as PMDoc;

    const attrs = allAttrs(toPlainDoc(doc));
    expect(
      attrs.every((a) => Object.getPrototypeOf(a) === Object.prototype),
    ).toBe(true);
  });
});
