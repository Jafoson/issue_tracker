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

describe("The registry", () => {
  it("describes every key exactly once", () => {
    expect(DEFAULT_ORDER).toEqual([...WIDGET_KEYS]);
    expect(new Set(DEFAULT_ORDER).size).toBe(DEFAULT_ORDER.length);
  });

  it("has exactly one widget that must stay", () => {
    // More than one would no longer be customization, and zero would allow
    // an empty dashboard that no one could find their way back from.
    const permanent = WIDGETS.filter((widget) => widget.permanent);
    expect(permanent.map((widget) => widget.key)).toEqual(["stats"]);
  });
});

describe("Without a saved setting", () => {
  it("the default applies, complete and in its order", () => {
    expect(resolveLayout()).toEqual({ visible: DEFAULT_ORDER, hidden: [] });
  });

  it("copes with empty lists too", () => {
    expect(resolveLayout([], [])).toEqual({
      visible: DEFAULT_ORDER,
      hidden: [],
    });
  });
});

describe("The saved order", () => {
  it("leads, as far as it reaches", () => {
    const { visible } = resolveLayout(["attention", "workload"]);
    expect(visible.slice(0, 2)).toEqual(["attention", "workload"]);
  });

  it("fills in the rest from the default without losing anything", () => {
    const { visible } = resolveLayout(["attention"]);
    expect(new Set(visible)).toEqual(new Set(DEFAULT_ORDER));
    expect(visible).toHaveLength(DEFAULT_ORDER.length);
  });

  it("still shows a widget added later", () => {
    // The actual reason for the incomplete stored data: a row from a time
    // when "attention" didn't exist yet.
    const stored = DEFAULT_ORDER.filter((key) => key !== "attention");
    expect(resolveLayout(stored).visible).toContain("attention");
  });

  it("skips the unknown instead of failing on it", () => {
    const { visible } = resolveLayout(["burndown", "attention"]);
    expect(visible).not.toContain("burndown" as WidgetKey);
    expect(visible[0]).toBe("attention");
  });

  it("takes a row stored twice only once", () => {
    const { visible } = resolveLayout(["attention", "attention", "workload"]);
    expect(visible.filter((key) => key === "attention")).toHaveLength(1);
    expect(visible).toHaveLength(DEFAULT_ORDER.length);
  });
});

describe("Hidden widgets", () => {
  it("aren't in the visible list, but are in the other one", () => {
    const { visible, hidden } = resolveLayout([], ["workload", "priority"]);
    expect(visible).not.toContain("workload");
    // In the resolved order, not the order they were stored in: `hidden` is a
    // selection from the same list as `visible`, and the default puts
    // "priority" before "workload".
    expect(hidden).toEqual(["priority", "workload"]);
  });

  it("keep their place in the order", () => {
    // Brought back, the widget is where it was again — that's why
    // `resolveLayout` maintains one order across all of them, not just the
    // visible ones.
    const { hidden } = resolveLayout(
      ["priority", "workload", "attention"],
      ["workload"],
    );
    expect(hidden).toEqual(["workload"]);
  });

  it("can't target the anchor", () => {
    // An old row can date from a time when that was still possible.
    const { visible, hidden } = resolveLayout([], ["stats"]);
    expect(visible).toContain("stats");
    expect(hidden).not.toContain("stats");
  });

  it("ignore the unknown", () => {
    const { visible } = resolveLayout([], ["burndown"]);
    expect(visible).toEqual(DEFAULT_ORDER);
  });
});

describe("Moving", () => {
  const order: WidgetKey[] = ["stats", "status", "throughput"];

  it("swaps with its neighbor", () => {
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

  it("does nothing at the edge", () => {
    expect(moveWidget(order, "stats", -1)).toEqual(order);
    expect(moveWidget(order, "throughput", 1)).toEqual(order);
  });

  it("leaves the input untouched", () => {
    const before = [...order];
    moveWidget(order, "status", 1);
    expect(order).toEqual(before);
  });

  it("does nothing for a key that isn't in the list", () => {
    expect(moveWidget(order, "attention", -1)).toEqual(order);
  });
});

describe("A single widget", () => {
  it("knows its width", () => {
    expect(widgetDef("stats").span).toBe("full");
    expect(widgetDef("status").span).toBe("half");
  });

  it("throws for a key that doesn't exist", () => {
    // Can only happen if someone lets `WIDGET_KEYS` and `WIDGETS` drift apart
    // — and then it should blow up loudly, not silently render nothing.
    expect(() => widgetDef("burndown" as WidgetKey)).toThrow();
  });
});
