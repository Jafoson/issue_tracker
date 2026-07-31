import { describe, expect, test } from "bun:test";
import { emptyDoc, isEmptyDoc, isPMDoc, toDoc } from "@/lib/richtext/doc";
import { fromMarkdown } from "@/lib/richtext/fromMarkdown";
import { mentionedUserIds, toPlainText, toPreview } from "@/lib/richtext/text";
import type { PMDoc } from "@/lib/richtext/types";

describe("toPlainText", () => {
  test("zieht den Text aus den Blöcken und trennt sie", () => {
    const doc = fromMarkdown("# Titel\n\nEin Absatz.");
    expect(toPlainText(doc)).toBe("Titel\nEin Absatz.");
  });

  test("nimmt die Chips mit — sonst fielen sie aus der Suche", () => {
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

  test("nimmt den Alt-Text eines Bildes mit", () => {
    expect(toPlainText(fromMarkdown("![Ein Diagramm](/d.png)"))).toContain(
      "Ein Diagramm",
    );
  });

  test("fasst Listenpunkte zeilenweise zusammen", () => {
    expect(toPlainText(fromMarkdown("- eins\n- zwei"))).toBe("eins\nzwei");
  });

  test("gibt für kaputte Eingaben einen leeren Text zurück", () => {
    expect(toPlainText(null)).toBe("");
    expect(toPlainText("kein Dokument")).toBe("");
    expect(toPlainText({ type: "doc" })).toBe("");
  });
});

describe("toPreview", () => {
  test("lässt kurzen Text unangetastet", () => {
    expect(toPreview(fromMarkdown("Kurz."))).toBe("Kurz.");
  });

  test("kürzt an der Wortgrenze und hängt ein Auslassungszeichen an", () => {
    const long = fromMarkdown("wort ".repeat(60));
    const preview = toPreview(long, 40);
    expect(preview.length).toBeLessThanOrEqual(41);
    expect(preview.endsWith("…")).toBe(true);
    // Nicht mitten im Wort abgeschnitten.
    expect(preview).not.toContain("wor…");
  });

  test("macht aus Umbrüchen Leerzeichen", () => {
    expect(toPreview(fromMarkdown("# Titel\n\nText"))).toBe("Titel Text");
  });
});

describe("isEmptyDoc", () => {
  test("erkennt das frische Dokument als leer", () => {
    expect(isEmptyDoc(emptyDoc())).toBe(true);
    expect(isEmptyDoc(fromMarkdown(""))).toBe(true);
    expect(isEmptyDoc(null)).toBe(true);
    expect(isEmptyDoc({ type: "doc", content: [] })).toBe(true);
  });

  test("erkennt Inhalt — auch wenn er nur aus einem Chip besteht", () => {
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
    // Ein Bild ist kein leerer Absatz.
    expect(isEmptyDoc(fromMarkdown("![a](/b.png)"))).toBe(false);
  });
});

describe("toDoc / isPMDoc", () => {
  test("lässt gültige Dokumente unverändert durch", () => {
    const doc = fromMarkdown("Text");
    expect(toDoc(doc)).toBe(doc);
    expect(isPMDoc(doc)).toBe(true);
  });

  test("ersetzt alles andere durch ein leeres Dokument", () => {
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
  test("findet Erwähnungen in beliebiger Tiefe und ohne Dubletten", () => {
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

  test("gibt für Text ohne Erwähnung eine leere Liste zurück", () => {
    expect(mentionedUserIds(fromMarkdown("nichts hier"))).toEqual([]);
  });
});
