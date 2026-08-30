import { describe, expect, test } from "bun:test";
import { emptyDoc, isEmptyDoc, isPMDoc, toDoc } from "@/lib/richtext/doc";
import { fromMarkdown } from "@/lib/richtext/fromMarkdown";
import { mentionedUserIds, toPlainText, toPreview } from "@/lib/richtext/text";
import type { PMDoc } from "@/lib/richtext/types";

describe("toPlainText", () => {
  test("pulls the text out of the blocks and separates them", () => {
    const doc = fromMarkdown("# Titel\n\nEin Absatz.");
    expect(toPlainText(doc)).toBe("Titel\nEin Absatz.");
  });

  test("includes the chips — otherwise they'd drop out of search", () => {
    const doc: PMDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Für " },
            { type: "mention", attrs: { id: "u1", label: "Anna Weber" } },
            { type: "text", text: " bis " },
            { type: "dateChip", attrs: { date: "2026-08-14" } },
            { type: "text", text: ", blockiert von " },
            { type: "issueLink", attrs: { id: "i1", identifier: "ORB-42" } },
          ],
        },
      ],
    };

    const text = toPlainText(doc);
    expect(text).toContain("@Anna Weber");
    expect(text).toContain("2026-08-14");
    expect(text).toContain("ORB-42");
  });

  test("includes an image's alt text", () => {
    expect(toPlainText(fromMarkdown("![Ein Diagramm](/d.png)"))).toContain(
      "Ein Diagramm",
    );
  });

  test("joins list items line by line", () => {
    expect(toPlainText(fromMarkdown("- eins\n- zwei"))).toBe("eins\nzwei");
  });

  test("returns empty text for broken input", () => {
    expect(toPlainText(null)).toBe("");
    expect(toPlainText("kein Dokument")).toBe("");
    expect(toPlainText({ type: "doc" })).toBe("");
  });
});

describe("toPreview", () => {
  test("leaves short text untouched", () => {
    expect(toPreview(fromMarkdown("Kurz."))).toBe("Kurz.");
  });

  test("truncates at a word boundary and appends an ellipsis", () => {
    const long = fromMarkdown("wort ".repeat(60));
    const preview = toPreview(long, 40);
    expect(preview.length).toBeLessThanOrEqual(41);
    expect(preview.endsWith("…")).toBe(true);
    // Not cut off in the middle of a word.
    expect(preview).not.toContain("wor…");
  });

  test("turns line breaks into spaces", () => {
    expect(toPreview(fromMarkdown("# Titel\n\nText"))).toBe("Titel Text");
  });
});

describe("isEmptyDoc", () => {
  test("recognizes a fresh document as empty", () => {
    expect(isEmptyDoc(emptyDoc())).toBe(true);
    expect(isEmptyDoc(fromMarkdown(""))).toBe(true);
    expect(isEmptyDoc(null)).toBe(true);
    expect(isEmptyDoc({ type: "doc", content: [] })).toBe(true);
  });

  test("recognizes content — even if it consists of just a chip", () => {
    expect(isEmptyDoc(fromMarkdown("Text"))).toBe(false);
    expect(
      isEmptyDoc({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "emoji", attrs: { name: "x", emoji: "🚀" } }],
          },
        ],
      }),
    ).toBe(false);
    // An image is not an empty paragraph.
    expect(isEmptyDoc(fromMarkdown("![a](/b.png)"))).toBe(false);
  });
});

describe("toDoc / isPMDoc", () => {
  test("lets valid documents through unchanged", () => {
    const doc = fromMarkdown("Text");
    expect(toDoc(doc)).toBe(doc);
    expect(isPMDoc(doc)).toBe(true);
  });

  test("replaces everything else with an empty document", () => {
    for (const bad of [
      null,
      undefined,
      42,
      "text",
      [],
      { type: "paragraph" },
    ]) {
      expect(isPMDoc(bad)).toBe(false);
      expect(toDoc(bad)).toEqual(emptyDoc());
    }
  });
});

describe("mentionedUserIds", () => {
  test("finds mentions at any depth and without duplicates", () => {
    const doc: PMDoc = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "mention", attrs: { id: "u1", label: "Anna" } },
                { type: "mention", attrs: { id: "u2", label: "Ben" } },
                { type: "mention", attrs: { id: "u1", label: "Anna" } },
              ],
            },
          ],
        },
      ],
    };
    expect(mentionedUserIds(doc).sort()).toEqual(["u1", "u2"]);
  });

  test("returns an empty list for text without mentions", () => {
    expect(mentionedUserIds(fromMarkdown("nichts hier"))).toEqual([]);
  });
});
