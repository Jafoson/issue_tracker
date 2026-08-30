import { describe, expect, it } from "bun:test";
import { MAIL_TEMPLATE_KEYS } from "@/features/mail-templates/catalog";
import { renderMailPreview } from "@/features/mail-templates/preview";

describe("renderMailPreview()", () => {
  it("renders every catalog key with sample data, without throwing", () => {
    for (const key of MAIL_TEMPLATE_KEYS) {
      const { subject, html, text } = renderMailPreview(key);
      expect(subject.length).toBeGreaterThan(0);
      expect(html).toContain("<!doctype html>");
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("applies an override to the preview", () => {
    const { subject } = renderMailPreview("invitation", {
      subject: "Test-Betreff für {{workspaceName}}",
      heading: "H",
      bodyText: "B",
    });
    expect(subject).toBe("Test-Betreff für Acme");
  });
});
