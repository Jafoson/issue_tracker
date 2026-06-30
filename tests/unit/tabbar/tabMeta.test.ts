import { describe, expect, it } from "bun:test";

import {
  tabColor,
  tabIcon,
  tabMeta,
  tabTitle,
} from "@/components/ui/layout/TabBar/tabMeta";
import type { Translator } from "@/i18n/types";
import type { Project } from "@/types";

const BASE = "/de/fuchsly";

const projects: Project[] = [
  {
    id: "p-1",
    name: "Fuchsly",
    slug: "fuchsly",
    prefix: "FUX",
    color: "#3b82f6",
  },
  {
    id: "p-2",
    name: "Side Project",
    slug: "side-project",
    prefix: "SID",
    color: "#22c55e",
  },
];

// Only the `nav` slice is used by the helpers — fake translator returning the
// German values for the nav keys that tabMeta/tabTitle look up.
const dict: Record<string, string> = {
  "nav.myIssues": "Meine Aufgaben",
  "nav.inbox": "Posteingang",
  "nav.board": "Board",
  "nav.issues": "Aufgaben",
  "nav.members": "Mitglieder",
  "nav.teams": "Teams",
  "nav.settings": "Einstellungen",
  "nav.projects": "Projekte",
};
const t = ((key: string) => dict[key] ?? key) as unknown as Translator;

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

describe("Projekte mit gleichem Namen aber unterschiedlichem Slug", () => {
  const dupeProjects: Project[] = [
    {
      id: "p-fuch",
      name: "Fuchsly",
      slug: "fuchsly",
      prefix: "FUCH",
      color: "#f59e0b",
    },
    {
      id: "p-fuc1",
      name: "Fuchsly",
      slug: "fuchsly-1",
      prefix: "FUC1",
      color: "#a78bfa",
    },
  ];

  it("löst /project/fuchsly auf das erste Projekt auf", () => {
    expect(tabColor(`${BASE}/project/fuchsly`, dupeProjects, BASE)).toBe(
      "#f59e0b",
    );
  });

  it("löst /project/fuchsly-1 auf das zweite Projekt auf", () => {
    expect(tabColor(`${BASE}/project/fuchsly-1`, dupeProjects, BASE)).toBe(
      "#a78bfa",
    );
  });

  it("verwechselt fuchsly und fuchsly-1 nicht", () => {
    const metaFuch = tabMeta(`${BASE}/project/fuchsly`, dupeProjects, t, BASE);
    const metaFuc1 = tabMeta(
      `${BASE}/project/fuchsly-1`,
      dupeProjects,
      t,
      BASE,
    );
    expect(metaFuch.color).toBe("#f59e0b");
    expect(metaFuc1.color).toBe("#a78bfa");
    expect(metaFuch.color).not.toBe(metaFuc1.color);
  });

  it("List-View von fuchsly-1 wird nicht als fuchsly erkannt", () => {
    expect(tabColor(`${BASE}/project/fuchsly-1/list`, dupeProjects, BASE)).toBe(
      "#a78bfa",
    );
    expect(tabColor(`${BASE}/project/fuchsly/list`, dupeProjects, BASE)).toBe(
      "#f59e0b",
    );
  });

  it("tabTitle gibt den richtigen Namen zurück (beide heißen Fuchsly)", () => {
    expect(tabTitle(`${BASE}/project/fuchsly`, dupeProjects, t, BASE)).toBe(
      "Fuchsly",
    );
    expect(tabTitle(`${BASE}/project/fuchsly-1`, dupeProjects, t, BASE)).toBe(
      "Fuchsly",
    );
  });
});
