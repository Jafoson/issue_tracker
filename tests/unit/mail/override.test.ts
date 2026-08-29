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
    // Otherwise, filling in just one field in the admin editor would pull
    // the other, still-empty fields to empty instead of leaving them at
    // their default.
    expect(resolveText("Default", "", {})).toBe("Default");
  });

  it("nimmt den platzhalter-ersetzten Override, wenn einer gesetzt ist", () => {
    expect(
      resolveText("Default", "Hallo {{firstName}}", { firstName: "Ada" }),
    ).toBe("Hallo Ada");
  });
});
