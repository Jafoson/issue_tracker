import { describe, expect, it } from "bun:test";
import {
  bucketKey,
  previousWindow,
  RANGES,
  rangeSpec,
  toRange,
  trend,
  truncate,
  windowFor,
} from "@/lib/buckets";

// Die Zeitachse des Dashboards. Sie ist reine Rechnerei ohne Datenbank — und
// genau die Sorte Code, die falsch sein kann, ohne dass es jemand sieht: eine um
// einen Tag verschobene Achse sieht aus wie ein Diagramm.

/** Ein Mittwoch, damit die Wochengrenze etwas zu tun hat. */
const WEDNESDAY = new Date(2026, 7, 12, 15, 30);

describe("Töpfe abschneiden", () => {
  it("setzt den Tag auf Mitternacht", () => {
    expect(truncate(WEDNESDAY, "day")).toEqual(new Date(2026, 7, 12));
  });

  it("setzt die Woche auf Montag", () => {
    // Der 12.08.2026 ist ein Mittwoch, der Montag davor der 10.
    expect(truncate(WEDNESDAY, "week")).toEqual(new Date(2026, 7, 10));
  });

  it("lässt einen Montag stehen, wo er ist", () => {
    const monday = new Date(2026, 7, 10, 9, 0);
    expect(truncate(monday, "week")).toEqual(new Date(2026, 7, 10));
  });

  it("zieht den Sonntag zur Woche davor", () => {
    // `getDay()` zählt ab Sonntag — der klassische Off-by-one an dieser Stelle.
    const sunday = new Date(2026, 7, 16, 23, 59);
    expect(truncate(sunday, "week")).toEqual(new Date(2026, 7, 10));
  });

  it("setzt den Monat auf den Ersten", () => {
    expect(truncate(WEDNESDAY, "month")).toEqual(new Date(2026, 7, 1));
  });
});

describe("Schlüssel", () => {
  it("schreibt das lokale Datum, nicht das nach UTC verschobene", () => {
    // `toISOString()` rechnet nach UTC um; östlich von Greenwich landete ein
    // Abendzeitpunkt dadurch einen Tag zu früh.
    expect(bucketKey(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });

  it("füllt Monat und Tag auf zwei Stellen", () => {
    expect(bucketKey(new Date(2026, 8, 7))).toBe("2026-09-07");
  });
});

describe("Das Fenster", () => {
  it("trägt so viele Marken, wie der Zeitraum vorsieht", () => {
    for (const range of RANGES) {
      const window = windowFor(range, WEDNESDAY);
      expect(window.keys).toHaveLength(rangeSpec(range).steps);
    }
  });

  it("hat keine doppelten Marken", () => {
    for (const range of RANGES) {
      const { keys } = windowFor(range, WEDNESDAY);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("endet auf dem laufenden Topf", () => {
    // Der heutige Tag zählt mit, obwohl er noch nicht vorbei ist: eine
    // Übersicht, die ihn verschweigt, beantwortet „was ist gerade los" nicht.
    const window = windowFor("30d", WEDNESDAY);
    expect(window.keys.at(-1)).toBe("2026-08-12");
    expect(window.keys[0]).toBe("2026-07-14");
  });

  it("läuft bei einem Jahr in Monaten", () => {
    const window = windowFor("12m", WEDNESDAY);
    expect(window.unit).toBe("month");
    expect(window.keys[0]).toBe("2025-09-01");
    expect(window.keys.at(-1)).toBe("2026-08-01");
  });

  it("läuft bei 90 Tagen in Wochen, jeweils ab Montag", () => {
    const window = windowFor("90d", WEDNESDAY);
    expect(window.unit).toBe("week");
    expect(window.keys.at(-1)).toBe("2026-08-10");
    // Jede Marke ist ein Montag.
    for (const key of window.keys) {
      expect(new Date(`${key}T00:00:00`).getDay()).toBe(1);
    }
  });

  it("schließt oben aus, damit der letzte Topf ganz hineinfällt", () => {
    const window = windowFor("7d", WEDNESDAY);
    // `to` ist der Anfang des Topfes *nach* dem Zeitraum.
    expect(window.to).toEqual(new Date(2026, 7, 13));
  });
});

describe("Der Zeitraum davor", () => {
  it("ist gleich lang und stößt an den aktuellen an", () => {
    const current = windowFor("30d", WEDNESDAY);
    const before = previousWindow(current, "30d");

    expect(before.keys).toHaveLength(current.keys.length);
    expect(before.to).toEqual(current.from);
    expect(before.keys.at(-1)).toBe("2026-07-13");
  });

  it("überlappt den aktuellen an keiner Stelle", () => {
    for (const range of RANGES) {
      const current = windowFor(range, WEDNESDAY);
      const before = previousWindow(current, range);
      const overlap = before.keys.filter((key) => current.keys.includes(key));
      expect(overlap).toEqual([]);
    }
  });
});

describe("Veränderung", () => {
  it("rechnet in Prozent", () => {
    expect(trend(120, 100)).toBe(20);
    expect(trend(80, 100)).toBe(-20);
    expect(trend(100, 100)).toBe(0);
  });

  it("sagt nichts, wenn vorher nichts war", () => {
    // Von null auf zehn ist keine Verhundertfachung, sondern ein Anfang.
    expect(trend(10, 0)).toBeNull();
    expect(trend(0, 0)).toBeNull();
  });
});

describe("Der Wert aus der Adresszeile", () => {
  it("nimmt an, was es gibt", () => {
    expect(toRange("7d")).toBe("7d");
    expect(toRange("12m")).toBe("12m");
  });

  it("fällt bei allem anderen auf 30 Tage zurück", () => {
    expect(toRange("alles")).toBe("30d");
    expect(toRange(undefined)).toBe("30d");
    expect(toRange("")).toBe("30d");
  });
});
