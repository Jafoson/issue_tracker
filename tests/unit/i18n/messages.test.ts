import { describe, expect, it } from "bun:test";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

// ─── Die Nachrichtendateien selbst ────────────────────────────────────────────
//
// Diese Datei prüft keine Übersetzung, sondern ihre Form. Beides hier geprüfte
// ist schon einmal schiefgegangen und fällt sonst erst im Browser auf — und dann
// nicht an einer Stelle, sondern überall: `NextIntlClientProvider` steht im
// Wurzel-Layout, ein kaputter Katalog nimmt die ganze App mit.

type Messages = { [key: string]: string | Messages };

/** Alle Schlüsselpfade einer Nachrichtendatei, flach. */
function paths(node: Messages, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const here = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [here] : paths(value, here);
  });
}

/** Alle Schlüssel*namen* — die einzelnen Stufen, nicht die Pfade. */
function names(node: Messages): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === "string" ? [key] : [key, ...names(value)],
  );
}

const catalogs = {
  de: de as unknown as Messages,
  en: en as unknown as Messages,
};

describe("Schlüsselnamen", () => {
  for (const [locale, messages] of Object.entries(catalogs)) {
    it(`enthält in ${locale} keinen Punkt im Namen`, () => {
      // next-intl liest den Punkt als Verschachtelung und lehnt einen Katalog
      // ab, der ihn im Namen trägt (`INVALID_KEY`). Wer einen Schlüssel wie
      // `project.deleted` braucht, schreibt ihn flach (`projectDeleted`) und
      // baut die Brücke im Code — siehe `ACTIONS` in `PlatformAudit`.
      const dotted = names(messages).filter((name) => name.includes("."));
      expect(dotted).toEqual([]);
    });
  }
});

describe("Beide Sprachen", () => {
  it("kennen dieselben Schlüssel", () => {
    const german = new Set(paths(catalogs.de));
    const english = new Set(paths(catalogs.en));

    // Getrennt geprüft, damit die Fehlermeldung sagt, in welche Richtung es
    // fehlt — „zwei Mengen sind ungleich" hilft beim Nachziehen nicht.
    expect([...german].filter((key) => !english.has(key))).toEqual([]);
    expect([...english].filter((key) => !german.has(key))).toEqual([]);
  });
});
