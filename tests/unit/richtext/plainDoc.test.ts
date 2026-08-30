import { describe, expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { MentionChip } from "@/components/ui/layout/RichTextEditor/extensions/chips";
import { toPlainDoc } from "@/lib/richtext/doc";
import type { PMDoc } from "@/lib/richtext/types";

/**
 * The trap the editor ran into:
 *
 * ProseMirror creates node attributes with `Object.create(null)`, and
 * `toJSON()` hands out exactly that object. React rejects objects without a
 * prototype when crossing into a Server Function (`isSimpleObject` checks the
 * prototype chain) and passes along a temporary reference instead of the
 * data — every access to it then fails on the server side.
 *
 * The test goes through real ProseMirror, not a reimplementation: that's the
 * only way it stays valid if ProseMirror's internals change.
 */

const schema = getSchema([StarterKit, MentionChip] as never);

/** A document the way `editor.getJSON()` delivers it. */
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

/** Collect all `attrs` in the tree. */
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
  test("ProseMirror returns attrs without a prototype — the assumption behind this test", () => {
    const attrs = allAttrs(fromEditor());
    expect(attrs.length).toBeGreaterThan(0);
    // Exactly what React rejects when crossing over to the server.
    expect(attrs.every((a) => Object.getPrototypeOf(a) === null)).toBe(true);
  });

  test("turns them into objects with a normal prototype", () => {
    const attrs = allAttrs(toPlainDoc(fromEditor()));
    expect(attrs.length).toBeGreaterThan(0);
    expect(
      attrs.every((a) => Object.getPrototypeOf(a) === Object.prototype),
    ).toBe(true);
  });

  test("leaves the content untouched in the process", () => {
    const plain = toPlainDoc(fromEditor());
    // Values identical — only the prototypes differ.
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

  test("also catches deeply nested attrs", () => {
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
