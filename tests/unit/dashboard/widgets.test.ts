import { describe, expect, it } from "bun:test";
import {
  moveWidget,
  resolveLayout,
  WIDGET_KEYS,
  WIDGETS,
  type WidgetKey,
  widgetDef,
} from "@/features/dashboard/widgets";

// Die Anordnung des Projekt-Dashboards. Reine Rechnerei ohne Datenbank — und die
// Sorte Code, deren Fehler man erst Monate später bemerkt: ein Baustein, den
// jemand später ergänzt, erscheint bei allen, die schon einmal etwas verstellt
// haben, entweder an der falschen Stelle oder gar nicht.

const DEFAULT_ORDER = WIDGETS.map((widget) => widget.key);

describe("Die Registry", () => {
  it("beschreibt jeden Schlüssel genau einmal", () => {
    expect(DEFAULT_ORDER).toEqual([...WIDGET_KEYS]);
    expect(new Set(DEFAULT_ORDER).size).toBe(DEFAULT_ORDER.length);
  });

  it("hat genau einen Baustein, der bleiben muss", () => {
    // Mehr als einer wäre keine Anpassung mehr, keiner ließe ein leeres
    // Dashboard zu, von dem aus niemand mehr zurückfindet.
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
    // Der eigentliche Grund für die unvollständige Speicherung: eine Zeile aus
    // einer Zeit, in der es „attention" noch nicht gab.
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
    // In der aufgelösten Reihenfolge, nicht in der, in der sie gespeichert
    // wurden: `hidden` ist eine Auswahl aus derselben Liste wie `visible`, und
    // die Vorgabe stellt „priority" vor „workload".
    expect(hidden).toEqual(["priority", "workload"]);
  });

  it("behalten ihren Platz in der Reihenfolge", () => {
    // Zurückgeholt steht der Baustein wieder dort, wo er war — deshalb führt
    // `resolveLayout` eine Reihenfolge über alle, nicht nur über die sichtbaren.
    const { hidden } = resolveLayout(
      ["priority", "workload", "attention"],
      ["workload"],
    );
    expect(hidden).toEqual(["workload"]);
  });

  it("können den Anker nicht treffen", () => {
    // Eine alte Zeile kann aus einer Zeit stammen, in der das noch ging.
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
    // Kann nur passieren, wenn jemand `WIDGET_KEYS` und `WIDGETS` auseinander
    // laufen lässt — und dann soll es krachen, nicht still nichts zeichnen.
    expect(() => widgetDef("burndown" as WidgetKey)).toThrow();
  });
});
