import { describe, expect, it } from "bun:test";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

// ─── The message files themselves ─────────────────────────────────────────────
//
// This file doesn't check translations, just their shape. Both things checked
// here have gone wrong before and would otherwise only surface in the
// browser — and then not in one place, but everywhere: `NextIntlClientProvider`
// sits in the root layout, so a broken catalog takes down the whole app.

type Messages = { [key: string]: string | Messages };

/** All key paths of a message file, flattened. */
function paths(node: Messages, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const here = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [here] : paths(value, here);
  });
}

/** All key *names* — the individual levels, not the paths. */
function names(node: Messages): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === "string" ? [key] : [key, ...names(value)],
  );
}

const catalogs = {
  de: de as unknown as Messages,
  en: en as unknown as Messages,
};

describe("Key names", () => {
  for (const [locale, messages] of Object.entries(catalogs)) {
    it(`has no dot in the name for ${locale}`, () => {
      // next-intl reads the dot as nesting and rejects a catalog that
      // carries one in a name (`INVALID_KEY`). Anyone who needs a key like
      // `project.deleted` writes it flat (`projectDeleted`) and builds the
      // bridge in code — see `ACTIONS` in `PlatformAudit`.
      const dotted = names(messages).filter((name) => name.includes("."));
      expect(dotted).toEqual([]);
    });
  }
});

describe("Both languages", () => {
  it("know the same keys", () => {
    const german = new Set(paths(catalogs.de));
    const english = new Set(paths(catalogs.en));

    // Checked separately so the failure message says which direction is
    // missing — "two sets are unequal" doesn't help when fixing it.
    expect([...german].filter((key) => !english.has(key))).toEqual([]);
    expect([...english].filter((key) => !german.has(key))).toEqual([]);
  });
});
