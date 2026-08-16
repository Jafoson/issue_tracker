import { describe, expect, it } from "bun:test";
import {
  DASHBOARD_SCOPES,
  DEFAULT_DASHBOARD_SCOPE,
  toDashboardScope,
} from "@/features/dashboard/scope";

// Ob ein Dashboard die Zahlen des ganzen Projekts/Workspace zeigt oder nur die
// der eigenen Person. Reine Rechnerei ohne Datenbank — die Rechteprüfung (wer
// „all" überhaupt wählen darf) sitzt in `getProjectDashboard`, nicht hier.

describe("Die Vorgabe", () => {
  it("ist der ganze Umfang", () => {
    expect(DEFAULT_DASHBOARD_SCOPE).toBe("all");
    expect(DASHBOARD_SCOPES).toContain(DEFAULT_DASHBOARD_SCOPE);
  });

  it("gilt, wenn gar nichts hereinkommt", () => {
    expect(toDashboardScope()).toBe("all");
    expect(toDashboardScope(undefined, null)).toBe("all");
  });
});

describe("Die Rangfolge", () => {
  it("nimmt den ersten bekannten Wert", () => {
    expect(toDashboardScope("mine", "all")).toBe("mine");
    expect(toDashboardScope("all", "mine")).toBe("all");
  });

  it("überspringt, was fehlt, und nimmt den nächsten", () => {
    expect(toDashboardScope(undefined, "mine")).toBe("mine");
    expect(toDashboardScope(null, "mine")).toBe("mine");
  });
});

describe("Unbekannte Werte", () => {
  it("fallen durch, statt zu werfen", () => {
    expect(toDashboardScope("gibtsnicht")).toBe("all");
    expect(toDashboardScope("")).toBe("all");
  });

  it("halten den nächsten Kandidaten nicht auf", () => {
    expect(toDashboardScope("gibtsnicht", "mine")).toBe("mine");
  });
});
