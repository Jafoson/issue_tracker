import { describe, expect, it } from "bun:test";
import { MAIL_TEMPLATE_KEYS } from "@/features/mail-templates/catalog";
import { renderMailPreview } from "@/features/mail-templates/preview";

describe("renderMailPreview()", () => {
  it("rendert jeden Katalog-Schlüssel mit Beispieldaten, ohne zu werfen", () => {
    for (const key of MAIL_TEMPLATE_KEYS) {
      const { subject, html, text } = renderMailPreview(key);
      expect(subject.length).toBeGreaterThan(0);
      expect(html).toContain("<!doctype html>");
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("wendet einen Override auf die Vorschau an", () => {
    const { subject } = renderMailPreview("invitation", {
      subject: "Test-Betreff für {{workspaceName}}",
      heading: "H",
      bodyText: "B",
    });
    expect(subject).toBe("Test-Betreff für Acme");
  });
});
