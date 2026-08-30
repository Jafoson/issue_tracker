import { describe, expect, it } from "bun:test";

import { isNavActive } from "@/lib/nav";

const PROJ = "/fuchsly/project/fuchsly";

describe("isNavActive()", () => {
  it("compares exactly when there is no pattern", () => {
    expect(isNavActive(`${PROJ}/list`, `${PROJ}/list`)).toBe(true);
    expect(isNavActive(`${PROJ}/list`, `${PROJ}`)).toBe(false);
  });

  it("prefers `activeHref` over `href`", () => {
    expect(
      isNavActive(`${PROJ}/list`, `${PROJ}/overview`, `${PROJ}/list`),
    ).toBe(true);
  });

  // Without the wildcard, "Settings" would lose its highlight as soon as you
  // open one of its sub-sections — and the branch in the sidebar would collapse.
  it("with `/*` also covers everything underneath", () => {
    const pattern = `${PROJ}/settings/*`;
    expect(isNavActive(`${PROJ}/settings`, "", pattern)).toBe(true);
    expect(isNavActive(`${PROJ}/settings/roles`, "", pattern)).toBe(true);
    expect(isNavActive(`${PROJ}/settings/labels`, "", pattern)).toBe(true);
  });

  it("with `/*` does not spill over onto siblings", () => {
    const pattern = `${PROJ}/settings/*`;
    expect(isNavActive(`${PROJ}/members`, "", pattern)).toBe(false);
    expect(isNavActive(`${PROJ}`, "", pattern)).toBe(false);
    // A prefix isn't a segment: /settings-alt doesn't belong to it.
    expect(isNavActive(`${PROJ}/settings-alt`, "", pattern)).toBe(false);
  });

  it("marks the project row active anywhere within the project", () => {
    const pattern = `${PROJ}/*`;
    expect(isNavActive(PROJ, "", pattern)).toBe(true);
    expect(isNavActive(`${PROJ}/list`, "", pattern)).toBe(true);
    expect(isNavActive(`${PROJ}/settings/labels`, "", pattern)).toBe(true);
    expect(isNavActive("/fuchsly/project/anderes", "", pattern)).toBe(false);
  });
});
