import { describe, expect, test } from "bun:test";
import { isoDate, parseDateInput, toIso } from "@/lib/richtext/date";

/**
 * What should count as a date in the `/` menu. The slash as a separator is
 * deliberately not among the formats tested here: it opens the menu and
 * would cut off the input.
 */

const jahr = new Date().getFullYear();

describe("parseDateInput", () => {
  test("reads the notation commonly used here", () => {
    expect(parseDateInput("1.2.2002")).toBe("2002-02-01");
    expect(parseDateInput("01.02.2002")).toBe("2002-02-01");
    expect(parseDateInput("14.8.2026")).toBe("2026-08-14");
  });

  test("expands two-digit years", () => {
    expect(parseDateInput("1.2.02")).toBe("2002-02-01");
    // From 69 backward — the cutoff from POSIX.
    expect(parseDateInput("1.2.98")).toBe("1998-02-01");
    expect(parseDateInput("1.2.68")).toBe("2068-02-01");
    expect(parseDateInput("1.2.69")).toBe("1969-02-01");
  });

  test("uses the current year when none is given", () => {
    expect(parseDateInput("1.2.")).toBe(`${jahr}-02-01`);
    expect(parseDateInput("1.2")).toBe(`${jahr}-02-01`);
  });

  test("understands the ISO form", () => {
    expect(parseDateInput("2002-02-01")).toBe("2002-02-01");
    expect(parseDateInput("2026-12-31")).toBe("2026-12-31");
  });

  test("also accepts hyphens with day first", () => {
    // Four digits at the start means ISO, otherwise day first.
    expect(parseDateInput("1-2-2002")).toBe("2002-02-01");
  });

  test("rejects days that don't exist", () => {
    expect(parseDateInput("31.02.2002")).toBeNull();
    expect(parseDateInput("32.1.2020")).toBeNull();
    expect(parseDateInput("1.13.2020")).toBeNull();
    expect(parseDateInput("2002-02-30")).toBeNull();
  });

  test("knows about the leap day", () => {
    expect(parseDateInput("29.2.2024")).toBe("2024-02-29");
    expect(parseDateInput("29.2.2023")).toBeNull();
  });

  test("leaves everything else alone", () => {
    for (const eingabe of [
      "",
      "   ",
      "heute",
      "date",
      "abc",
      "1.",
      "..",
      "12",
    ]) {
      expect(parseDateInput(eingabe)).toBeNull();
    }
  });

  test("is not bothered by surrounding whitespace", () => {
    expect(parseDateInput("  1.2.2002  ")).toBe("2002-02-01");
  });
});

describe("isoDate / toIso", () => {
  test("pads to two digits", () => {
    expect(toIso(2026, 2, 1)).toBe("2026-02-01");
    expect(toIso(2026, 12, 31)).toBe("2026-12-31");
  });

  test("counts days forward — even across a month boundary", () => {
    const heute = new Date();
    expect(isoDate()).toBe(
      toIso(heute.getFullYear(), heute.getMonth() + 1, heute.getDate()),
    );

    const inSieben = new Date();
    inSieben.setDate(inSieben.getDate() + 7);
    expect(isoDate(7)).toBe(
      toIso(
        inSieben.getFullYear(),
        inSieben.getMonth() + 1,
        inSieben.getDate(),
      ),
    );
  });

  test("produces something the parser understands again", () => {
    expect(parseDateInput(isoDate(30))).toBe(isoDate(30));
  });
});
