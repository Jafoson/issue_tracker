import { describe, expect, test } from "bun:test";
import {
  formatBytes,
  type ResolvedAttachmentRef,
  stripAttachmentAttrs,
  withResolvedAttachments,
} from "@/lib/richtext/attachments";
import type { PMDoc } from "@/lib/richtext/types";

function docWith(attrs: Record<string, unknown> | null): PMDoc {
  return {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Vorher" }] },
      { type: "attachment", attrs },
      { type: "paragraph", content: [{ type: "text", text: "Danach" }] },
    ],
  };
}

const RESOLVED: Record<string, ResolvedAttachmentRef> = {
  "att-1": {
    url: "https://s3.example/attachments/i-1/x.png",
    name: "screenshot.png",
    mimeType: "image/png",
    size: 2048,
  },
};

describe("withResolvedAttachments()", () => {
  test("reichert einen bekannten Anhang um url/name/mimeType/size an", () => {
    const doc = docWith({ id: "att-1" });
    const resolved = withResolvedAttachments(doc, RESOLVED);
    expect(resolved.content?.[1].attrs).toEqual({
      id: "att-1",
      url: "https://s3.example/attachments/i-1/x.png",
      name: "screenshot.png",
      mimeType: "image/png",
      size: 2048,
    });
  });

  test("lässt einen unbekannten Anhang ohne url — gelöschter Anhang", () => {
    const doc = docWith({ id: "att-gone" });
    const resolved = withResolvedAttachments(doc, RESOLVED);
    expect(resolved.content?.[1].attrs).toEqual({
      id: "att-gone",
      url: null,
      name: "",
      mimeType: null,
      size: null,
    });
  });

  test("läuft rekursiv durch verschachtelte Knoten (z.B. in einem Zitat)", () => {
    const doc: PMDoc = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [{ type: "attachment", attrs: { id: "att-1" } }],
        },
      ],
    };
    const resolved = withResolvedAttachments(doc, RESOLVED);
    expect(resolved.content?.[0].content?.[0].attrs?.url).toBe(
      "https://s3.example/attachments/i-1/x.png",
    );
  });

  test("lässt andere Knotentypen unverändert", () => {
    const doc: PMDoc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
    };
    expect(withResolvedAttachments(doc, RESOLVED)).toEqual(doc);
  });
});

describe("stripAttachmentAttrs()", () => {
  test("wirft alles außer id ab — auch versehentlich mitgeschickte Attribute", () => {
    const doc = docWith({
      id: "att-1",
      url: "https://s3.example/attachments/i-1/x.png",
      name: "screenshot.png",
      mimeType: "image/png",
      size: 2048,
    });
    const stripped = stripAttachmentAttrs(doc);
    expect(stripped.content?.[1].attrs).toEqual({ id: "att-1" });
  });

  test("läuft rekursiv durch verschachtelte Knoten", () => {
    const doc: PMDoc = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "attachment",
              attrs: { id: "att-1", url: "https://s3.example/x.png" },
            },
          ],
        },
      ],
    };
    expect(stripAttachmentAttrs(doc).content?.[0].content?.[0].attrs).toEqual({
      id: "att-1",
    });
  });
});

describe("formatBytes()", () => {
  test("zeigt Bytes unter 1 KB direkt", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  test("rechnet in KB/MB/GB um", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB");
  });
});
