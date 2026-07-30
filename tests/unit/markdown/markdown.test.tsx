import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "@/components/ui/atoms/Markdown/Markdown";

const render = (source: string) =>
  renderToStaticMarkup(<Markdown>{source}</Markdown>);

describe("Markdown", () => {
  test("rendert Überschriften nach Anzahl der Rauten", () => {
    expect(render("# Eins")).toContain("<h1>Eins</h1>");
    expect(render("### Drei")).toContain("<h3>Drei</h3>");
    // Ohne Leerzeichen ist es keine Überschrift, sondern Text.
    expect(render("#kein Titel")).toContain("<p>#kein Titel</p>");
  });

  test("rendert Auszeichnungen innerhalb eines Absatzes", () => {
    const html = render("Ein **fetter**, *kursiver* und ~~alter~~ `Code`.");
    expect(html).toContain("<strong>fetter</strong>");
    expect(html).toContain("<em>kursiver</em>");
    expect(html).toContain("<del>alter</del>");
    expect(html).toContain("<code>Code</code>");
  });

  test("hält zusammenhängende Zeilen in einem Absatz", () => {
    const html = render("Erste Zeile\nZweite Zeile\n\nNeuer Absatz");
    expect(html).toContain("<p>Erste Zeile\nZweite Zeile</p>");
    expect(html).toContain("<p>Neuer Absatz</p>");
  });

  test("erkennt beide Listenarten", () => {
    expect(render("- eins\n- zwei")).toContain(
      "<ul><li>eins</li><li>zwei</li></ul>",
    );
    expect(render("1. eins\n2. zwei")).toContain(
      "<ol><li>eins</li><li>zwei</li></ol>",
    );
  });

  test("fasst aufeinanderfolgende Zitatzeilen zusammen", () => {
    expect(render("> eins\n> zwei")).toContain(
      "<blockquote>eins\nzwei</blockquote>",
    );
  });

  test("gibt Code-Blöcke unverändert und ohne HTML-Wirkung aus", () => {
    const html = render("```ts\nconst x = <b>1</b>;\n```");
    expect(html).toContain("<pre><code>const x = &lt;b&gt;1&lt;/b&gt;;</code>");
    expect(html).not.toContain("<b>1</b>");
  });

  test("verlinkt nur harmlose Adressen", () => {
    const safe = render("[Orbit](https://example.com)");
    expect(safe).toContain('href="https://example.com"');
    expect(safe).toContain('rel="noopener noreferrer"');

    // `javascript:` bleibt Text — es entsteht gar kein Link.
    const unsafe = render("[böse](javascript:alert(1))");
    expect(unsafe).not.toContain("<a");
    expect(unsafe).toContain("javascript:alert(1)");
  });

  test("verlinkt nackte Adressen und rendert Bilder", () => {
    expect(render("Siehe https://example.com/x")).toContain(
      '<a href="https://example.com/x"',
    );
    expect(render("![Alt](https://example.com/a.png)")).toContain(
      '<img src="https://example.com/a.png" alt="Alt"/>',
    );
  });

  test("rendert Trennlinien", () => {
    expect(render("---")).toContain("<hr/>");
  });
});
