import { describe, expect, it } from "bun:test";
import {
  DEFAULT_PROJECT_VIEW,
  PROJECT_VIEWS,
  toProjectView,
} from "@/features/dashboard/view";

// Welche der beiden Ansichten die Projektseite öffnet. Reine Rechnerei ohne
// Datenbank — und die Stelle, an der drei Quellen zusammenkommen: die Adresse,
// der Vermerk im Konto und die Vorgabe. Läuft die Rangfolge auseinander, öffnet
// ein geteilter Link beim Empfänger etwas anderes, als der Absender gesehen hat.

describe("Die Vorgabe", () => {
  it("ist der Steckbrief", () => {
    // Er beantwortet „was ist das hier" — die Frage dessen, der ein Projekt zum
    // ersten Mal öffnet.
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
    // Der Alltagsfall: keine Adresse, aber ein Vermerk im Konto.
    expect(toProjectView(undefined, "dashboard")).toBe("dashboard");
    expect(toProjectView(null, "dashboard")).toBe("dashboard");
  });

  it("lässt die Adresse über den Vermerk im Konto siegen", () => {
    // Ein geteilter Link soll zeigen, was der Absender gesehen hat.
    expect(toProjectView("profile", "dashboard")).toBe("profile");
  });
});

describe("Unbekannte Werte", () => {
  it("fallen durch, statt zu werfen", () => {
    // Ein Tippfehler in einem Parameter, der nur die Darstellung wählt, ist kein
    // Grund für eine 404.
    expect(toProjectView("gibtsnicht")).toBe("profile");
    expect(toProjectView("")).toBe("profile");
  });

  it("halten den nächsten Kandidaten nicht auf", () => {
    expect(toProjectView("gibtsnicht", "dashboard")).toBe("dashboard");
  });
});
