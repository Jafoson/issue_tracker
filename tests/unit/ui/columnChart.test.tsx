import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type ChartPoint,
  ColumnChart,
} from "@/components/ui/charts/ColumnChart/ColumnChart";

// Liegt in `tests/unit/ui` und nicht bei den übrigen Dashboard-Tests: hier wird
// gerendert, und `react-dom/server` verträgt sich nicht mit dem `react`-Stub aus
// `issues/getLabels.test.ts`. Das `test`-Script trennt beide Gruppen in eigene
// Prozesse — Renderndes gehört in diese.
//
// Zwei Zusagen des Diagramms, die man dem Bild nicht ansieht, solange sie
// stimmen — und die beim nächsten Umbau still kaputtgehen können:
//
//   1. Die Achse beschriftet nicht jede Säule, und zwei Beschriftungen stehen
//      nie nebeneinander. Bei dreißig Tagesspalten überschrieben sie sich sonst.
//   2. Jede Zahl ist auch ohne Zeiger erreichbar. Der Tooltip darf ergänzen, er
//      darf nicht der einzige Weg sein.

const SERIES = [
  { key: "issues", label: "Aufgaben", color: "var(--chart-1)" },
  { key: "comments", label: "Kommentare", color: "var(--chart-2)" },
];

function days(count: number): ChartPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `2026-08-${String(index + 1).padStart(2, "0")}`,
    label: `${index + 1}. August 2026`,
    short: `${index + 1}.8.`,
    values: { issues: index, comments: count - index },
  }));
}

/** Die Beschriftungen der Achse, in Reihenfolge — leere eingeschlossen. */
function ticks(markup: string): string[] {
  const axis = markup.split('<div class="xAxis')[1] ?? "";
  return [...axis.matchAll(/<span class="tick[^"]*">([^<]*)<\/span>/g)].map(
    (match) => match[1],
  );
}

describe("Achsenbeschriftung", () => {
  it("beschriftet bei einer Woche jede Säule", () => {
    const markup = renderToStaticMarkup(
      <ColumnChart series={SERIES} points={days(7)} label="Test" />,
    );
    expect(ticks(markup).filter(Boolean)).toHaveLength(7);
  });

  it("lässt bei dreißig Tagen höchstens acht stehen", () => {
    const markup = renderToStaticMarkup(
      <ColumnChart series={SERIES} points={days(30)} label="Test" />,
    );
    const shown = ticks(markup).filter(Boolean);
    expect(shown.length).toBeGreaterThan(2);
    expect(shown.length).toBeLessThanOrEqual(8);
  });

  it("stellt nie zwei Beschriftungen nebeneinander", () => {
    // Der Fall, der es in die erste Fassung geschafft hatte: die reguläre Marke
    // bei Index 28 und die immer gesetzte letzte bei 29.
    for (const count of [7, 12, 13, 30, 90]) {
      const markup = renderToStaticMarkup(
        <ColumnChart series={SERIES} points={days(count)} label="Test" />,
      );
      const all = ticks(markup);
      // Bis acht Säulen trägt jede ihre Beschriftung — dort ist Nachbarschaft
      // kein Zusammenstoß, sondern die Absicht: die Spalten sind breit genug.
      if (count <= 8) continue;

      const collisions = all.filter(
        (label, index) => index > 0 && label !== "" && all[index - 1] !== "",
      );
      expect({ count, collisions }).toEqual({ count, collisions: [] });
    }
  });

  it("beschriftet immer die letzte Säule", () => {
    const markup = renderToStaticMarkup(
      <ColumnChart series={SERIES} points={days(30)} label="Test" />,
    );
    expect(ticks(markup).at(-1)).toBe("30.8.");
  });
});

describe("Jede Zahl ohne Zeiger erreichbar", () => {
  it("nennt in der Beschriftung jeder Säule alle Reihen", () => {
    // Der Tastaturweg: Fokus auf einer Säule liest dasselbe vor, was der
    // Tooltip zeigt.
    const markup = renderToStaticMarkup(
      <ColumnChart series={SERIES} points={days(3)} label="Test" />,
    );
    expect(markup).toContain(
      'aria-label="1. August 2026: 0 Aufgaben, 3 Kommentare"',
    );
  });

  it("zeigt als Tabelle dieselben Werte", () => {
    const markup = renderToStaticMarkup(
      <ColumnChart series={SERIES} points={days(3)} label="Verlauf" asTable />,
    );

    expect(markup).toContain("<table");
    expect(markup).toContain("Verlauf");
    // Eine Kopfzelle je Reihe, eine Zeile je Topf.
    expect(markup).toContain("Aufgaben");
    expect(markup).toContain("Kommentare");
    expect(markup).toContain("3. August 2026");
    // Keine Säulen mehr, wenn die Tabelle steht.
    expect(markup).not.toContain('aria-label="1. August 2026');
  });
});
