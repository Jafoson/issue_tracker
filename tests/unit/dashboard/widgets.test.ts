import { describe, expect, it } from "bun:test";
import {
  moveWidget,
  resolveLayout,
  WIDGET_KEYS,
  WIDGETS,
  type WidgetKey,
  widgetDef,
} from "@/features/dashboard/widgets";

// The layout of the project dashboard. Pure arithmetic with no database
// involved — and the kind of code whose bugs you only notice months later: a
// widget added later either shows up in the wrong spot or not at all for
// anyone who has already rearranged something.

const DEFAULT_ORDER = WIDGETS.map((widget) => widget.key);

describe("Die Registry", () => {
  it("beschreibt jeden Schlüssel genau einmal", () => {
    expect(DEFAULT_ORDER).toEqual([...WIDGET_KEYS]);
    expect(new Set(DEFAULT_ORDER).size).toBe(DEFAULT_ORDER.length);
  });

  it("hat genau einen Baustein, der bleiben muss", () => {
    // More than one would no longer be customization, and zero would allow
    // an empty dashboard that no one could find their way back from.
    const permanent = WIDGETS.filter((widget) => widget.permanent);
    expect(permanent.map((widget) => widget.key)).toEqual(["stats"]);
  });
});

describe("Ohne gespeicherte Einstellung", () => {
  it("gilt die Vorgabe, vollständig und in ihrer Reihenfolge", () => {
    expect(resolveLayout()).toEqual({ visible: DEFAULT_ORDER, hidden: [] });
  });

  it("kommt auch mit leeren Listen zurecht", () => {
    expect(resolveLayout([], [])).toEqual({
      visible: DEFAULT_ORDER,
      hidden: [],
    });
  });
});

describe("Die gespeicherte Reihenfolge", () => {
  it("führt, soweit sie reicht", () => {
    const { visible } = resolveLayout(["attention", "workload"]);
    expect(visible.slice(0, 2)).toEqual(["attention", "workload"]);
  });

  it("ergänzt den Rest aus der Vorgabe, ohne etwas zu verlieren", () => {
    const { visible } = resolveLayout(["attention"]);
    expect(new Set(visible)).toEqual(new Set(DEFAULT_ORDER));
    expect(visible).toHaveLength(DEFAULT_ORDER.length);
  });

  it("zeigt einen später ergänzten Baustein trotzdem an", () => {
    // The actual reason for the incomplete stored data: a row from a time
    // when "attention" didn't exist yet.
    const stored = DEFAULT_ORDER.filter((key) => key !== "attention");
    expect(resolveLayout(stored).visible).toContain("attention");
  });

  it("überspringt Unbekanntes statt daran zu scheitern", () => {
    const { visible } = resolveLayout(["burndown", "attention"]);
    expect(visible).not.toContain("burndown" as WidgetKey);
    expect(visible[0]).toBe("attention");
  });

  it("nimmt eine doppelt gespeicherte Zeile nur einmal", () => {
    const { visible } = resolveLayout(["attention", "attention", "workload"]);
    expect(visible.filter((key) => key === "attention")).toHaveLength(1);
    expect(visible).toHaveLength(DEFAULT_ORDER.length);
  });
});

describe("Ausgeblendete Bausteine", () => {
  it("stehen nicht in der sichtbaren Liste, aber in der anderen", () => {
    const { visible, hidden } = resolveLayout([], ["workload", "priority"]);
    expect(visible).not.toContain("workload");
    // In the resolved order, not the order they were stored in: `hidden` is a
    // selection from the same list as `visible`, and the default puts
    // "priority" before "workload".
    expect(hidden).toEqual(["priority", "workload"]);
  });

  it("behalten ihren Platz in der Reihenfolge", () => {
    // Brought back, the widget is where it was again — that's why
    // `resolveLayout` maintains one order across all of them, not just the
    // visible ones.
    const { hidden } = resolveLayout(
      ["priority", "workload", "attention"],
      ["workload"],
    );
    expect(hidden).toEqual(["workload"]);
  });

  it("können den Anker nicht treffen", () => {
    // An old row can date from a time when that was still possible.
    const { visible, hidden } = resolveLayout([], ["stats"]);
    expect(visible).toContain("stats");
    expect(hidden).not.toContain("stats");
  });

  it("ignorieren Unbekanntes", () => {
    const { visible } = resolveLayout([], ["burndown"]);
    expect(visible).toEqual(DEFAULT_ORDER);
  });
});

describe("Verschieben", () => {
  const order: WidgetKey[] = ["stats", "status", "throughput"];

  it("tauscht mit dem Nachbarn", () => {
    expect(moveWidget(order, "status", -1)).toEqual([
      "status",
      "stats",
      "throughput",
    ]);
    expect(moveWidget(order, "status", 1)).toEqual([
      "stats",
      "throughput",
      "status",
    ]);
  });

  it("tut am Rand nichts", () => {
    expect(moveWidget(order, "stats", -1)).toEqual(order);
    expect(moveWidget(order, "throughput", 1)).toEqual(order);
  });

  it("lässt die Eingabe unangetastet", () => {
    const before = [...order];
    moveWidget(order, "status", 1);
    expect(order).toEqual(before);
  });

  it("tut nichts für einen Schlüssel, der nicht in der Liste steht", () => {
    expect(moveWidget(order, "attention", -1)).toEqual(order);
  });
});

describe("Ein einzelner Baustein", () => {
  it("kennt seine Breite", () => {
    expect(widgetDef("stats").span).toBe("full");
    expect(widgetDef("status").span).toBe("half");
  });

  it("wirft bei einem Schlüssel, den es nicht gibt", () => {
    // Can only happen if someone lets `WIDGET_KEYS` and `WIDGETS` drift apart
    // — and then it should blow up loudly, not silently render nothing.
    expect(() => widgetDef("burndown" as WidgetKey)).toThrow();
  });
});
