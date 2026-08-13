import { describe, expect, it } from "bun:test";

import { isNavActive } from "@/lib/nav";

const PROJ = "/fuchsly/project/fuchsly";

describe("isNavActive()", () => {
  it("vergleicht ohne Muster exakt", () => {
    expect(isNavActive(`${PROJ}/list`, `${PROJ}/list`)).toBe(true);
    expect(isNavActive(`${PROJ}/list`, `${PROJ}`)).toBe(false);
  });

  it("zieht `activeHref` dem `href` vor", () => {
    expect(
      isNavActive(`${PROJ}/list`, `${PROJ}/overview`, `${PROJ}/list`),
    ).toBe(true);
  });

  // Ohne die Wildcard verlöre „Einstellungen" seine Markierung, sobald man
  // einen ihrer Bereiche öffnet — und der Zweig in der Seitenleiste klappte zu.
  it("deckt mit `/*` auch alles unterhalb ab", () => {
    const pattern = `${PROJ}/settings/*`;
    expect(isNavActive(`${PROJ}/settings`, "", pattern)).toBe(true);
    expect(isNavActive(`${PROJ}/settings/roles`, "", pattern)).toBe(true);
    expect(isNavActive(`${PROJ}/settings/labels`, "", pattern)).toBe(true);
  });

  it("greift mit `/*` nicht auf Nachbarn über", () => {
    const pattern = `${PROJ}/settings/*`;
    expect(isNavActive(`${PROJ}/members`, "", pattern)).toBe(false);
    expect(isNavActive(`${PROJ}`, "", pattern)).toBe(false);
    // Ein Präfix ist noch kein Segment: /settings-alt gehört nicht dazu.
    expect(isNavActive(`${PROJ}/settings-alt`, "", pattern)).toBe(false);
  });

  it("markiert die Projektzeile überall im Projekt", () => {
    const pattern = `${PROJ}/*`;
    expect(isNavActive(PROJ, "", pattern)).toBe(true);
    expect(isNavActive(`${PROJ}/list`, "", pattern)).toBe(true);
    expect(isNavActive(`${PROJ}/settings/labels`, "", pattern)).toBe(true);
    expect(isNavActive("/fuchsly/project/anderes", "", pattern)).toBe(false);
  });
});
