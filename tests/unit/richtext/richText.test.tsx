import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RichText } from "@/components/ui/atoms/RichText/RichText";
import type { PMDoc, PMNode } from "@/lib/richtext/types";

const render = (doc: PMDoc) => renderToStaticMarkup(<RichText value={doc} />);

/** Kürzt die Testfälle: ein Dokument aus den übergebenen Blöcken. */
const doc = (...content: PMNode[]): PMDoc => ({ type: "doc", content });

/** Ein Absatz aus einem einzelnen Textknoten. */
const p = (text: string, marks?: PMNode["marks"]): PMNode => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
});

describe("RichText", () => {
  test("rendert Überschriften auf ihrer Ebene", () => {
    expect(
      render(
        doc({
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Eins" }],
        }),
      ),
    ).toContain("<h1>Eins</h1>");

    expect(
      render(
        doc({
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Drei" }],
        }),
      ),
    ).toContain("<h3>Drei</h3>");
  });

  test("begrenzt unsinnige Überschriftenebenen auf h1–h6", () => {
    const html = render(
      doc({
        type: "heading",
        attrs: { level: 99 },
        content: [{ type: "text", text: "Tief" }],
      }),
    );
    expect(html).toContain("<h6>Tief</h6>");
  });

  test("legt Auszeichnungen um den Text", () => {
    expect(render(doc(p("fett", [{ type: "bold" }])))).toContain(
      "<strong>fett</strong>",
    );
    expect(render(doc(p("kursiv", [{ type: "italic" }])))).toContain(
      "<em>kursiv</em>",
    );
    expect(render(doc(p("weg", [{ type: "strike" }])))).toContain(
      "<del>weg</del>",
    );
    expect(render(doc(p("code", [{ type: "code" }])))).toContain(
      "<code>code</code>",
    );
  });

  test("schachtelt mehrere Auszeichnungen ineinander", () => {
    const html = render(
      doc(p("beides", [{ type: "bold" }, { type: "italic" }])),
    );
    expect(html).toContain("<em><strong>beides</strong></em>");
  });

  test("rendert beide Listenarten", () => {
    const item = (text: string): PMNode => ({
      type: "listItem",
      content: [p(text)],
    });

    expect(
      render(doc({ type: "bulletList", content: [item("a"), item("b")] })),
    ).toContain("<ul><li><p>a</p></li><li><p>b</p></li></ul>");

    expect(
      render(doc({ type: "orderedList", content: [item("a")] })),
    ).toContain("<ol><li><p>a</p></li></ol>");
  });

  test("rendert Checklisten mit ihrem Zustand", () => {
    const html = render(
      doc({
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: true },
            content: [p("fertig")],
          },
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [p("offen")],
          },
        ],
      }),
    );
    expect(html).toContain('data-checked="true"');
    expect(html).toContain('data-checked="false"');
    // Nur Anzeige — angehakt wird im Editor.
    expect(html).toContain("disabled");
  });

  test("rendert Zitat, Codeblock und Trennlinie", () => {
    expect(
      render(doc({ type: "blockquote", content: [p("zitiert")] })),
    ).toContain("<blockquote><p>zitiert</p></blockquote>");

    expect(
      render(
        doc({
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [{ type: "text", text: "const a = 1" }],
        }),
      ),
    ).toContain('<code data-language="ts">const a = 1</code>');

    expect(render(doc({ type: "horizontalRule" }))).toContain("<hr/>");
  });

  test("rendert die Chips mit ihren Attributen", () => {
    const html = render(
      doc({
        type: "paragraph",
        content: [
          { type: "mention", attrs: { id: "u1", label: "Anna Weber" } },
          { type: "issueLink", attrs: { id: "i1", identifier: "ORB-42" } },
          { type: "dateChip", attrs: { date: "2026-08-14" } },
          { type: "emoji", attrs: { name: "rocket", emoji: "🚀" } },
        ],
      }),
    );

    expect(html).toContain("@Anna Weber");
    expect(html).toContain("ORB-42");
    expect(html).toContain('href="?issue=ORB-42"');
    // React gibt `dateTime` unverändert aus; HTML-Attribute sind
    // schreibweisenunabhängig, im Browser ist das dasselbe Attribut.
    expect(html).toContain("<time");
    expect(html).toContain('dateTime="2026-08-14"');
    expect(html).toContain("🚀");
  });

  test("rendert Panels nach ihrer Art", () => {
    const html = render(
      doc({
        type: "panel",
        attrs: { kind: "warning" },
        content: [p("Achtung")],
      }),
    );
    expect(html).toContain('data-kind="warning"');
    expect(html).toContain("<p>Achtung</p>");
  });

  test("rendert Tabellen in einem scrollenden Rahmen", () => {
    const html = render(
      doc({
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableHeader", content: [p("Kopf")] },
              { type: "tableCell", content: [p("Zelle")] },
            ],
          },
        ],
      }),
    );
    expect(html).toContain("<th><p>Kopf</p></th>");
    expect(html).toContain("<td><p>Zelle</p></td>");
  });

  test("lässt gefährliche Adressen nicht ins Dokument", () => {
    const html = render(
      doc(
        p("klick", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]),
      ),
    );
    // Der Text bleibt, der Link verschwindet.
    expect(html).toContain("klick");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<a");
  });

  test("lässt harmlose Adressen durch und öffnet sie sicher", () => {
    const html = render(
      doc(p("hin", [{ type: "link", attrs: { href: "https://example.com" } }])),
    );
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  test("verwirft Bilder mit unsicherer Quelle", () => {
    expect(
      render(doc({ type: "image", attrs: { src: "javascript:x", alt: "a" } })),
    ).not.toContain("<img");

    expect(
      render(doc({ type: "image", attrs: { src: "/bild.png", alt: "a" } })),
    ).toContain('src="/bild.png"');
  });

  test("überlebt kaputte Eingaben", () => {
    // Was nicht wie ein Dokument aussieht, wird zum leeren Dokument — ein
    // einzelner leerer Absatz, kein Absturz und kein fremder Inhalt.
    for (const bad of [
      null,
      undefined,
      42,
      "kein Doc",
      { type: "paragraph" },
    ]) {
      expect(renderToStaticMarkup(<RichText value={bad} />)).toBe(
        '<div class="richText"><p></p></div>',
      );
    }
    // Ein `doc` ohne `content` ist gültig und bleibt leer.
    expect(renderToStaticMarkup(<RichText value={{ type: "doc" }} />)).toBe(
      '<div class="richText"></div>',
    );
  });

  test("zeigt den Inhalt unbekannter Knoten trotzdem an", () => {
    const html = render(
      doc({ type: "somethingNew", content: [p("bleibt lesbar")] }),
    );
    expect(html).toContain("bleibt lesbar");
  });
});

describe("RichText — Chips", () => {
  const mention = (attrs: Record<string, unknown>) =>
    renderToStaticMarkup(
      <RichText
        value={{
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "mention", attrs }] },
          ],
        }}
      />,
    );

  test("zeigt beim Mitglied ein @ vor dem Namen", () => {
    const html = mention({ id: "u1", label: "Anna Weber" });
    expect(html).toContain("@");
    expect(html).toContain("Anna Weber");
  });

  test("zeigt das Datum lesbar und behält den ISO-Wert im Attribut", () => {
    const html = renderToStaticMarkup(
      <RichText
        value={{
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "dateChip", attrs: { date: "2026-08-14" } }],
            },
          ],
        }}
      />,
    );
    expect(html).toContain('dateTime="2026-08-14"');
    // Nicht mehr die Rohform im Text — dieselbe Schreibweise wie im Editor.
    expect(html).not.toMatch(/>2026-08-14</);
    expect(html).toMatch(/2026/);
  });
});
