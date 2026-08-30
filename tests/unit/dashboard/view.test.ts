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

describe("The default", () => {
  it("is the profile", () => {
    // It answers "what is this" — the question of someone opening a project
    // for the first time.
    expect(DEFAULT_PROJECT_VIEW).toBe("profile");
    expect(PROJECT_VIEWS).toContain(DEFAULT_PROJECT_VIEW);
  });

  it("applies when nothing comes in at all", () => {
    expect(toProjectView()).toBe("profile");
    expect(toProjectView(undefined, null)).toBe("profile");
  });
});

describe("The precedence", () => {
  it("takes the first known value", () => {
    expect(toProjectView("dashboard", "profile")).toBe("dashboard");
    expect(toProjectView("profile", "dashboard")).toBe("profile");
  });

  it("skips what's missing and takes the next one", () => {
    // The everyday case: no URL, but a note in the account.
    expect(toProjectView(undefined, "dashboard")).toBe("dashboard");
    expect(toProjectView(null, "dashboard")).toBe("dashboard");
  });

  it("lets the URL win over the note in the account", () => {
    // A shared link should show what the sender saw.
    expect(toProjectView("profile", "dashboard")).toBe("profile");
  });
});

describe("Unknown values", () => {
  it("fall through instead of throwing", () => {
    // A typo in a parameter that only selects the presentation is no reason
    // for a 404.
    expect(toProjectView("gibtsnicht")).toBe("profile");
    expect(toProjectView("")).toBe("profile");
  });

  it("don't hold up the next candidate", () => {
    expect(toProjectView("gibtsnicht", "dashboard")).toBe("dashboard");
  });
});
