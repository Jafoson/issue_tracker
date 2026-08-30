import { describe, expect, it } from "bun:test";
import { applyPlaceholders, resolveText } from "@/lib/mail/templates/override";

describe("applyPlaceholders()", () => {
  it("replaces known placeholders", () => {
    expect(
      applyPlaceholders("Hallo {{firstName}}!", { firstName: "Ada" }),
    ).toBe("Hallo Ada!");
  });

  it("leaves an unknown placeholder as literal text", () => {
    expect(applyPlaceholders("Hallo {{unknown}}!", { firstName: "Ada" })).toBe(
      "Hallo {{unknown}}!",
    );
  });

  it("replaces the same placeholder multiple times", () => {
    expect(
      applyPlaceholders("{{name}} und nochmal {{name}}", { name: "Ada" }),
    ).toBe("Ada und nochmal Ada");
  });
});

describe("resolveText()", () => {
  it("takes the default when no override is set", () => {
    expect(resolveText("Default", undefined, {})).toBe("Default");
  });

  it("takes the default for an empty override field too", () => {
    // Otherwise, filling in just one field in the admin editor would pull
    // the other, still-empty fields to empty instead of leaving them at
    // their default.
    expect(resolveText("Default", "", {})).toBe("Default");
  });

  it("takes the placeholder-substituted override when one is set", () => {
    expect(
      resolveText("Default", "Hallo {{firstName}}", { firstName: "Ada" }),
    ).toBe("Hallo Ada");
  });
});
