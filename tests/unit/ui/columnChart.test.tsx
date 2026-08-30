import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type ChartPoint,
  ColumnChart,
} from "@/components/ui/charts/ColumnChart/ColumnChart";

// Lives in `tests/unit/ui` rather than with the rest of the dashboard tests:
// this one renders, and `react-dom/server` doesn't get along with the `react`
// stub from `issues/getLabels.test.ts`. The `test` script splits both groups
// into their own processes — anything that renders belongs in this one.
//
// Two promises the chart makes that you can't see in the picture as long as
// they hold — and that can silently break on the next redesign:
//
//   1. The axis doesn't label every column, and two labels never sit next to
//      each other. With thirty daily columns they'd otherwise overlap.
//   2. Every number is reachable without a pointer. The tooltip may add to
//      that, it may not be the only way.

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

/** The axis labels, in order — including empty ones. */
function ticks(markup: string): string[] {
  const axis = markup.split('<div class="xAxis')[1] ?? "";
  return [...axis.matchAll(/<span class="tick[^"]*">([^<]*)<\/span>/g)].map(
    (match) => match[1],
  );
}

describe("Axis labels", () => {
  it("labels every column for a week", () => {
    const markup = renderToStaticMarkup(
      <ColumnChart series={SERIES} points={days(7)} label="Test" />,
    );
    expect(ticks(markup).filter(Boolean)).toHaveLength(7);
  });

  it("leaves at most eight standing for thirty days", () => {
    const markup = renderToStaticMarkup(
      <ColumnChart series={SERIES} points={days(30)} label="Test" />,
    );
    const shown = ticks(markup).filter(Boolean);
    expect(shown.length).toBeGreaterThan(2);
    expect(shown.length).toBeLessThanOrEqual(8);
  });

  it("never places two labels next to each other", () => {
    // The case that made it into the first version: the regular tick at
    // index 28 and the always-shown last one at 29.
    for (const count of [7, 12, 13, 30, 90]) {
      const markup = renderToStaticMarkup(
        <ColumnChart series={SERIES} points={days(count)} label="Test" />,
      );
      const all = ticks(markup);
      // Up to eight columns, each one carries its own label — there,
      // adjacency isn't a collision but the intent: the columns are wide
      // enough.
      if (count <= 8) continue;

      const collisions = all.filter(
        (label, index) => index > 0 && label !== "" && all[index - 1] !== "",
      );
      expect({ count, collisions }).toEqual({ count, collisions: [] });
    }
  });

  it("always labels the last column", () => {
    const markup = renderToStaticMarkup(
      <ColumnChart series={SERIES} points={days(30)} label="Test" />,
    );
    expect(ticks(markup).at(-1)).toBe("30.8.");
  });
});

describe("Every value reachable without a pointer", () => {
  it("names all series in every column's label", () => {
    // The keyboard path: focusing a column reads out the same thing the
    // tooltip shows.
    const markup = renderToStaticMarkup(
      <ColumnChart series={SERIES} points={days(3)} label="Test" />,
    );
    expect(markup).toContain(
      'aria-label="1. August 2026: 0 Aufgaben, 3 Kommentare"',
    );
  });

  it("shows the same values as a table", () => {
    const markup = renderToStaticMarkup(
      <ColumnChart series={SERIES} points={days(3)} label="Verlauf" asTable />,
    );

    expect(markup).toContain("<table");
    expect(markup).toContain("Verlauf");
    // One header cell per series, one row per bucket.
    expect(markup).toContain("Aufgaben");
    expect(markup).toContain("Kommentare");
    expect(markup).toContain("3. August 2026");
    // No more columns once the table is showing.
    expect(markup).not.toContain('aria-label="1. August 2026');
  });
});
