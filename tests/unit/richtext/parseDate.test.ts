import { describe, expect, test } from "bun:test";
import { isoDate, parseDateInput, toIso } from "@/lib/richtext/date";

/**
 * Was im `/`-Menü als Datum durchgehen soll. Der Schrägstrich als Trenner ist
 * bewusst nicht dabei: er öffnet das Menü und schnitte die Eingabe ab.
 */

const jahr = new Date().getFullYear();

describe("parseDateInput", () => {
  test("liest die hier übliche Schreibweise", () => {
    expect(parseDateInput("1.2.2002")).toBe("2002-02-01");
    expect(parseDateInput("01.02.2002")).toBe("2002-02-01");
    expect(parseDateInput("14.8.2026")).toBe("2026-08-14");
  });

  test("ergänzt zweistellige Jahreszahlen", () => {
    expect(parseDateInput("1.2.02")).toBe("2002-02-01");
    // Ab 69 rückwärts — die Grenze aus POSIX.
    expect(parseDateInput("1.2.98")).toBe("1998-02-01");
    expect(parseDateInput("1.2.68")).toBe("2068-02-01");
    expect(parseDateInput("1.2.69")).toBe("1969-02-01");
  });

  test("nimmt ohne Jahr das laufende", () => {
    expect(parseDateInput("1.2.")).toBe(`${jahr}-02-01`);
    expect(parseDateInput("1.2")).toBe(`${jahr}-02-01`);
  });

  test("versteht die ISO-Form", () => {
    expect(parseDateInput("2002-02-01")).toBe("2002-02-01");
    expect(parseDateInput("2026-12-31")).toBe("2026-12-31");
  });

  test("nimmt auch Bindestriche mit Tag zuerst", () => {
    // Vier Stellen vorn heißt ISO, sonst Tag zuerst.
    expect(parseDateInput("1-2-2002")).toBe("2002-02-01");
  });

  test("lehnt Tage ab, die es nicht gibt", () => {
    expect(parseDateInput("31.02.2002")).toBeNull();
    expect(parseDateInput("32.1.2020")).toBeNull();
    expect(parseDateInput("1.13.2020")).toBeNull();
    expect(parseDateInput("2002-02-30")).toBeNull();
  });

  test("kennt den Schalttag", () => {
    expect(parseDateInput("29.2.2024")).toBe("2024-02-29");
    expect(parseDateInput("29.2.2023")).toBeNull();
  });

  test("lässt alles andere liegen", () => {
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

  test("stört sich nicht an Leerzeichen am Rand", () => {
    expect(parseDateInput("  1.2.2002  ")).toBe("2002-02-01");
  });
});

describe("isoDate / toIso", () => {
  test("füllt auf zwei Stellen auf", () => {
    expect(toIso(2026, 2, 1)).toBe("2026-02-01");
    expect(toIso(2026, 12, 31)).toBe("2026-12-31");
  });

  test("zählt Tage vorwärts — auch über den Monatswechsel", () => {
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

  test("liefert etwas, das der Parser wieder versteht", () => {
    expect(parseDateInput(isoDate(30))).toBe(isoDate(30));
  });
});
