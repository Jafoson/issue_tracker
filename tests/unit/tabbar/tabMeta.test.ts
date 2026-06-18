import { describe, expect, it } from "bun:test";

import {
  tabIcon,
  tabMeta,
  tabTitle,
} from "@/components/ui/layout/TabBar/tabMeta";
import type { T } from "@/lib/translations-context";
import type { Project } from "@/types";

const BASE = "/de/fuchsly";

const projects: Project[] = [
  { id: "p-1", name: "Fuchsly", prefix: "FUX", color: "#3b82f6" },
  { id: "p-2", name: "Side Project", prefix: "SID", color: "#22c55e" },
];

// Only the `nav` slice is used by the helpers — cast a minimal stub as T.
const t = {
  nav: {
    myIssues: "Meine Aufgaben",
    inbox: "Posteingang",
    board: "Board",
    issues: "Aufgaben",
    members: "Mitglieder",
    teams: "Teams",
    settings: "Einstellungen",
    projects: "Projekte",
  },
} as unknown as T;

describe("tabTitle()", () => {
  it("gibt den Projektnamen für eine Projekt-Board-URL zurück", () => {
    expect(tabTitle(`${BASE}/project/fuchsly`, projects, t, BASE)).toBe(
      "Fuchsly",
    );
  });

  it("löst den Slug mit Bindestrichen korrekt auf", () => {
    expect(tabTitle(`${BASE}/project/side-project`, projects, t, BASE)).toBe(
      "Side Project",
    );
  });

  it("fällt auf 'Board' zurück wenn das Projekt unbekannt ist", () => {
    expect(tabTitle(`${BASE}/project/unbekannt`, projects, t, BASE)).toBe(
      "Board",
    );
  });

  it("mappt die übrigen Navigationsrouten auf ihre Übersetzung", () => {
    expect(tabTitle(`${BASE}/my`, projects, t, BASE)).toBe("Meine Aufgaben");
    expect(tabTitle(`${BASE}/inbox`, projects, t, BASE)).toBe("Posteingang");
    expect(tabTitle(`${BASE}/members`, projects, t, BASE)).toBe("Mitglieder");
    expect(tabTitle(`${BASE}/teams`, projects, t, BASE)).toBe("Teams");
    expect(tabTitle(`${BASE}/settings`, projects, t, BASE)).toBe(
      "Einstellungen",
    );
    expect(tabTitle(`${BASE}/projects`, projects, t, BASE)).toBe("Projekte");
  });
});

describe("tabIcon()", () => {
  it("nutzt das Listen-Icon für die /list-Ansicht eines Projekts", () => {
    expect(tabIcon(`${BASE}/project/fuchsly/list`, BASE)).toBe("lucide:list");
  });

  it("nutzt das Board-Icon für die Board-Ansicht eines Projekts", () => {
    expect(tabIcon(`${BASE}/project/fuchsly`, BASE)).toBe(
      "lucide:layout-dashboard",
    );
  });
});

describe("tabMeta()", () => {
  it("entfernt den Query-String bevor Titel/Farbe/Icon abgeleitet werden", () => {
    const meta = tabMeta(
      `${BASE}/project/fuchsly?status=todo&priority=2`,
      projects,
      t,
      BASE,
    );
    expect(meta.title).toBe("Fuchsly");
    expect(meta.color).toBe("#3b82f6");
    // Projektfarbe vorhanden → kein Icon, sondern der Farbpunkt wird gezeigt.
    expect(meta.icon).toBeNull();
  });

  it("hängt das (Aufgaben)-Suffix bei der Listen-Ansicht an", () => {
    expect(
      tabMeta(`${BASE}/project/fuchsly/list`, projects, t, BASE).title,
    ).toBe("Fuchsly (Aufgaben)");
  });

  it("behält das Suffix auch mit aktiven Filtern im Query-String", () => {
    expect(
      tabMeta(`${BASE}/project/fuchsly/list?status=done`, projects, t, BASE)
        .title,
    ).toBe("Fuchsly (Aufgaben)");
  });

  it("hängt KEIN Suffix bei der Board-Ansicht an", () => {
    expect(
      tabMeta(`${BASE}/project/fuchsly?status=done`, projects, t, BASE).title,
    ).toBe("Fuchsly");
  });

  it("gibt für Nicht-Projekt-Routen ein Icon und keine Farbe zurück", () => {
    const meta = tabMeta(`${BASE}/my`, projects, t, BASE);
    expect(meta.title).toBe("Meine Aufgaben");
    expect(meta.color).toBeNull();
    expect(meta.icon).toBe("lucide:user");
  });
});
