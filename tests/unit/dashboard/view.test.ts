import { describe, expect, it } from "bun:test";
import {
  DEFAULT_PROJECT_VIEW,
  PROJECT_VIEWS,
  toProjectView,
} from "@/features/dashboard/view";

// Which of the two views the project page opens. Pure arithmetic with no
// database involved — and the spot where three sources come together: the
// URL, the note in the account, and the default. If the precedence order
// diverges, a shared link opens something different for the recipient than
// what the sender saw.

describe("Die Vorgabe", () => {
  it("ist der Steckbrief", () => {
    // It answers "what is this" — the question of someone opening a project
    // for the first time.
    expect(DEFAULT_PROJECT_VIEW).toBe("profile");
    expect(PROJECT_VIEWS).toContain(DEFAULT_PROJECT_VIEW);
  });

  it("gilt, wenn gar nichts hereinkommt", () => {
    expect(toProjectView()).toBe("profile");
    expect(toProjectView(undefined, null)).toBe("profile");
  });
});

describe("Die Rangfolge", () => {
  it("nimmt den ersten bekannten Wert", () => {
    expect(toProjectView("dashboard", "profile")).toBe("dashboard");
    expect(toProjectView("profile", "dashboard")).toBe("profile");
  });

  it("überspringt, was fehlt, und nimmt den nächsten", () => {
    // The everyday case: no URL, but a note in the account.
    expect(toProjectView(undefined, "dashboard")).toBe("dashboard");
    expect(toProjectView(null, "dashboard")).toBe("dashboard");
  });

  it("lässt die Adresse über den Vermerk im Konto siegen", () => {
    // A shared link should show what the sender saw.
    expect(toProjectView("profile", "dashboard")).toBe("profile");
  });
});

describe("Unbekannte Werte", () => {
  it("fallen durch, statt zu werfen", () => {
    // A typo in a parameter that only selects the presentation is no reason
    // for a 404.
    expect(toProjectView("gibtsnicht")).toBe("profile");
    expect(toProjectView("")).toBe("profile");
  });

  it("halten den nächsten Kandidaten nicht auf", () => {
    expect(toProjectView("gibtsnicht", "dashboard")).toBe("dashboard");
  });
});
