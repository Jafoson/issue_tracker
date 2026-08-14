import { describe, expect, it } from "bun:test";
import {
  MAIL_TEMPLATE_CATALOG,
  MAIL_TEMPLATE_KEYS,
  mailTemplateMeta,
} from "@/features/mail-templates/catalog";

describe("MAIL_TEMPLATE_CATALOG", () => {
  it("hat für jeden Schlüssel genau einen Eintrag mit passendem `key`", () => {
    for (const key of MAIL_TEMPLATE_KEYS) {
      const meta = mailTemplateMeta(key);
      expect(meta.key).toBe(key);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.group.length).toBeGreaterThan(0);
      expect(meta.placeholders.length).toBeGreaterThan(0);
    }
  });

  it("hat keine doppelten Schlüssel", () => {
    expect(new Set(MAIL_TEMPLATE_KEYS).size).toBe(MAIL_TEMPLATE_KEYS.length);
  });

  it("stimmt mit den Objekt-Schlüsseln von MAIL_TEMPLATE_CATALOG überein", () => {
    expect(new Set(Object.keys(MAIL_TEMPLATE_CATALOG))).toEqual(
      new Set(MAIL_TEMPLATE_KEYS),
    );
  });
});
