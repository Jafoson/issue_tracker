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

// The dashboard's time axis. It's pure arithmetic with no database involved —
// and exactly the kind of code that can be wrong without anyone noticing: an
// axis shifted by one day still looks like a chart.

/** A Wednesday, so the week boundary has something to do. */
const WEDNESDAY = new Date(2026, 7, 12, 15, 30);

describe("Truncating buckets", () => {
  it("sets the day to midnight", () => {
    expect(truncate(WEDNESDAY, "day")).toEqual(new Date(2026, 7, 12));
  });

  it("sets the week to Monday", () => {
    // 2026-08-12 is a Wednesday, the Monday before it is the 10th.
    expect(truncate(WEDNESDAY, "week")).toEqual(new Date(2026, 7, 10));
  });

  it("leaves a Monday where it is", () => {
    const monday = new Date(2026, 7, 10, 9, 0);
    expect(truncate(monday, "week")).toEqual(new Date(2026, 7, 10));
  });

  it("pulls Sunday back to the previous week", () => {
    // `getDay()` counts from Sunday — the classic off-by-one at this spot.
    const sunday = new Date(2026, 7, 16, 23, 59);
    expect(truncate(sunday, "week")).toEqual(new Date(2026, 7, 10));
  });

  it("sets the month to the first", () => {
    expect(truncate(WEDNESDAY, "month")).toEqual(new Date(2026, 7, 1));
  });
});

describe("Key", () => {
  it("writes the local date, not the one shifted to UTC", () => {
    // `toISOString()` converts to UTC; east of Greenwich this would land an
    // evening timestamp one day too early.
    expect(bucketKey(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });

  it("pads month and day to two digits", () => {
    expect(bucketKey(new Date(2026, 8, 7))).toBe("2026-09-07");
  });
});

describe("The window", () => {
  it("carries as many marks as the range calls for", () => {
    for (const range of RANGES) {
      const window = windowFor(range, WEDNESDAY);
      expect(window.keys).toHaveLength(rangeSpec(range).steps);
    }
  });

  it("has no duplicate marks", () => {
    for (const range of RANGES) {
      const { keys } = windowFor(range, WEDNESDAY);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("ends on the current bucket", () => {
    // Today counts too, even though it isn't over yet: an overview that omits
    // it doesn't answer "what's happening right now".
    const window = windowFor("30d", WEDNESDAY);
    expect(window.keys.at(-1)).toBe("2026-08-12");
    expect(window.keys[0]).toBe("2026-07-14");
  });

  it("runs in months for a one-year range", () => {
    const window = windowFor("12m", WEDNESDAY);
    expect(window.unit).toBe("month");
    expect(window.keys[0]).toBe("2025-09-01");
    expect(window.keys.at(-1)).toBe("2026-08-01");
  });

  it("runs in weeks for 90 days, each starting on a Monday", () => {
    const window = windowFor("90d", WEDNESDAY);
    expect(window.unit).toBe("week");
    expect(window.keys.at(-1)).toBe("2026-08-10");
    // Every mark is a Monday.
    for (const key of window.keys) {
      expect(new Date(`${key}T00:00:00`).getDay()).toBe(1);
    }
  });

  it("is exclusive at the top, so the last bucket fits in fully", () => {
    const window = windowFor("7d", WEDNESDAY);
    // `to` is the start of the bucket *after* the range.
    expect(window.to).toEqual(new Date(2026, 7, 13));
  });
});

describe("The preceding period", () => {
  it("is the same length and abuts the current one", () => {
    const current = windowFor("30d", WEDNESDAY);
    const before = previousWindow(current, "30d");

    expect(before.keys).toHaveLength(current.keys.length);
    expect(before.to).toEqual(current.from);
    expect(before.keys.at(-1)).toBe("2026-07-13");
  });

  it("doesn't overlap the current one anywhere", () => {
    for (const range of RANGES) {
      const current = windowFor(range, WEDNESDAY);
      const before = previousWindow(current, range);
      const overlap = before.keys.filter((key) => current.keys.includes(key));
      expect(overlap).toEqual([]);
    }
  });
});

describe("Change", () => {
  it("computes in percent", () => {
    expect(trend(120, 100)).toBe(20);
    expect(trend(80, 100)).toBe(-20);
    expect(trend(100, 100)).toBe(0);
  });

  it("says nothing when there was nothing before", () => {
    // Going from zero to ten isn't a percentage increase, it's a beginning.
    expect(trend(10, 0)).toBeNull();
    expect(trend(0, 0)).toBeNull();
  });
});

describe("The value from the address bar", () => {
  it("accepts what exists", () => {
    expect(toRange("7d")).toBe("7d");
    expect(toRange("12m")).toBe("12m");
  });

  it("falls back to 30 days for anything else", () => {
    expect(toRange("alles")).toBe("30d");
    expect(toRange(undefined)).toBe("30d");
    expect(toRange("")).toBe("30d");
  });
});
