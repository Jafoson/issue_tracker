import { describe, expect, it } from "bun:test";
import { applyPlaceholders, resolveText } from "@/lib/mail/templates/override";

describe("applyPlaceholders()", () => {
  it("ersetzt bekannte Platzhalter", () => {
    expect(
      applyPlaceholders("Hallo {{firstName}}!", { firstName: "Ada" }),
    ).toBe("Hallo Ada!");
  });

  it("lässt einen unbekannten Platzhalter wörtlich stehen", () => {
    expect(applyPlaceholders("Hallo {{unknown}}!", { firstName: "Ada" })).toBe(
      "Hallo {{unknown}}!",
    );
  });

  it("ersetzt denselben Platzhalter mehrfach", () => {
    expect(
      applyPlaceholders("{{name}} und nochmal {{name}}", { name: "Ada" }),
    ).toBe("Ada und nochmal Ada");
  });
});

describe("resolveText()", () => {
  it("nimmt den Default, wenn kein Override gesetzt ist", () => {
    expect(resolveText("Default", undefined, {})).toBe("Default");
  });

  it("nimmt den Default auch bei einem leeren Override-Feld", () => {
    // Sonst würde das Ausfüllen nur eines Felds im Admin-Editor die anderen,
    // noch leeren Felder auf leer ziehen statt auf ihrem Default zu bleiben.
    expect(resolveText("Default", "", {})).toBe("Default");
  });

  it("nimmt den platzhalter-ersetzten Override, wenn einer gesetzt ist", () => {
    expect(
      resolveText("Default", "Hallo {{firstName}}", { firstName: "Ada" }),
    ).toBe("Hallo Ada");
  });
});
