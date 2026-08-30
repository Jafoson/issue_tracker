import { describe, expect, it } from "bun:test";
import {
  DASHBOARD_SCOPES,
  DEFAULT_DASHBOARD_SCOPE,
  toDashboardScope,
} from "@/features/dashboard/scope";

// Whether a dashboard shows the numbers for the whole project/workspace or
// only for the current person. Pure arithmetic with no database involved —
// the permission check (who's even allowed to choose "all") lives in
// `getProjectDashboard`, not here.

describe("The default", () => {
  it("is the full scope", () => {
    expect(DEFAULT_DASHBOARD_SCOPE).toBe("all");
    expect(DASHBOARD_SCOPES).toContain(DEFAULT_DASHBOARD_SCOPE);
  });

  it("applies when nothing comes in at all", () => {
    expect(toDashboardScope()).toBe("all");
    expect(toDashboardScope(undefined, null)).toBe("all");
  });
});

describe("The precedence", () => {
  it("takes the first known value", () => {
    expect(toDashboardScope("mine", "all")).toBe("mine");
    expect(toDashboardScope("all", "mine")).toBe("all");
  });

  it("skips what's missing and takes the next one", () => {
    expect(toDashboardScope(undefined, "mine")).toBe("mine");
    expect(toDashboardScope(null, "mine")).toBe("mine");
  });
});

describe("Unknown values", () => {
  it("fall through instead of throwing", () => {
    expect(toDashboardScope("gibtsnicht")).toBe("all");
    expect(toDashboardScope("")).toBe("all");
  });

  it("don't hold up the next candidate", () => {
    expect(toDashboardScope("gibtsnicht", "mine")).toBe("mine");
  });
});
