import { describe, expect, it } from "bun:test";

import {
  tabColor,
  tabIcon,
  tabMeta,
  tabTitle,
} from "@/components/ui/layout/TabBar/tabMeta";
import type { Translator } from "@/i18n/types";
import type { Project } from "@/types";

// Tab-URLs sind locale-agnostisch (next-intl usePathname) — erstes Segment ist
// der Bereich (Workspace-ID oder "admin"), zweites die Sektion.
const BASE = "/fuchsly";

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
  "nav.general": "Allgemein",
  "nav.roles": "Rollen & Rechte",
};
const t = ((key: string) => dict[key] ?? key) as unknown as Translator;

describe("tabTitle()", () => {
  it("gibt den Projektnamen für eine Projekt-Board-URL zurück", () => {
    expect(tabTitle(`${BASE}/project/fuchsly`, projects, t)).toBe("Fuchsly");
  });

  it("löst den Slug mit Bindestrichen korrekt auf", () => {
    expect(tabTitle(`${BASE}/project/side-project`, projects, t)).toBe(
      "Side Project",
    );
  });

  it("fällt auf 'Board' zurück wenn das Projekt unbekannt ist", () => {
    expect(tabTitle(`${BASE}/project/unbekannt`, projects, t)).toBe("Board");
  });

  it("mappt die übrigen Navigationsrouten auf ihre Übersetzung", () => {
    expect(tabTitle(`${BASE}/my`, projects, t)).toBe("Meine Aufgaben");
    expect(tabTitle(`${BASE}/inbox`, projects, t)).toBe("Posteingang");
    expect(tabTitle(`${BASE}/members`, projects, t)).toBe("Mitglieder");
    expect(tabTitle(`${BASE}/teams`, projects, t)).toBe("Teams");
    expect(tabTitle(`${BASE}/settings`, projects, t)).toBe("Einstellungen");
    expect(tabTitle(`${BASE}/projects`, projects, t)).toBe("Projekte");
  });
});

describe("tabIcon()", () => {
  it("nutzt das Listen-Icon für die /list-Ansicht eines Projekts", () => {
    expect(tabIcon(`${BASE}/project/fuchsly/list`)).toBe("lucide:list");
  });

  it("nutzt das Board-Icon für die Board-Ansicht eines Projekts", () => {
    expect(tabIcon(`${BASE}/project/fuchsly`)).toBe("lucide:layout-dashboard");
  });
});

describe("Admin-Routen", () => {
  it("mappt /admin auf 'Allgemein' mit Settings-Icon", () => {
    expect(tabTitle("/admin", projects, t)).toBe("Allgemein");
    expect(tabIcon("/admin")).toBe("lucide:settings");
  });

  it("mappt /admin/members", () => {
    expect(tabTitle("/admin/members", projects, t)).toBe("Mitglieder");
    expect(tabIcon("/admin/members")).toBe("lucide:users");
  });

  it("mappt /admin/roles", () => {
    expect(tabTitle("/admin/roles", projects, t)).toBe("Rollen & Rechte");
    expect(tabIcon("/admin/roles")).toBe("lucide:shield-check");
  });

  it("hat für Admin nie eine Projektfarbe", () => {
    expect(tabColor("/admin", projects)).toBeNull();
    expect(tabColor("/admin/members", projects)).toBeNull();
  });
});

describe("tabMeta()", () => {
  it("entfernt den Query-String bevor Titel/Farbe/Icon abgeleitet werden", () => {
    const meta = tabMeta(
      `${BASE}/project/fuchsly?status=todo&priority=2`,
      projects,
      t,
    );
    expect(meta.title).toBe("Fuchsly");
    expect(meta.color).toBe("#3b82f6");
    // Projektfarbe vorhanden → kein Icon, sondern der Farbpunkt wird gezeigt.
    expect(meta.icon).toBeNull();
  });

  it("hängt das (Aufgaben)-Suffix bei der Listen-Ansicht an", () => {
    expect(tabMeta(`${BASE}/project/fuchsly/list`, projects, t).title).toBe(
      "Fuchsly (Aufgaben)",
    );
  });

  it("behält das Suffix auch mit aktiven Filtern im Query-String", () => {
    expect(
      tabMeta(`${BASE}/project/fuchsly/list?status=done`, projects, t).title,
    ).toBe("Fuchsly (Aufgaben)");
  });

  it("hängt KEIN Suffix bei der Board-Ansicht an", () => {
    expect(
      tabMeta(`${BASE}/project/fuchsly?status=done`, projects, t).title,
    ).toBe("Fuchsly");
  });

  it("gibt für Nicht-Projekt-Routen ein Icon und keine Farbe zurück", () => {
    const meta = tabMeta(`${BASE}/my`, projects, t);
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
    expect(tabColor(`${BASE}/project/fuchsly`, dupeProjects)).toBe("#f59e0b");
  });

  it("löst /project/fuchsly-1 auf das zweite Projekt auf", () => {
    expect(tabColor(`${BASE}/project/fuchsly-1`, dupeProjects)).toBe("#a78bfa");
  });

  it("verwechselt fuchsly und fuchsly-1 nicht", () => {
    const metaFuch = tabMeta(`${BASE}/project/fuchsly`, dupeProjects, t);
    const metaFuc1 = tabMeta(`${BASE}/project/fuchsly-1`, dupeProjects, t);
    expect(metaFuch.color).toBe("#f59e0b");
    expect(metaFuc1.color).toBe("#a78bfa");
    expect(metaFuch.color).not.toBe(metaFuc1.color);
  });

  it("List-View von fuchsly-1 wird nicht als fuchsly erkannt", () => {
    expect(tabColor(`${BASE}/project/fuchsly-1/list`, dupeProjects)).toBe(
      "#a78bfa",
    );
    expect(tabColor(`${BASE}/project/fuchsly/list`, dupeProjects)).toBe(
      "#f59e0b",
    );
  });

  it("tabTitle gibt den richtigen Namen zurück (beide heißen Fuchsly)", () => {
    expect(tabTitle(`${BASE}/project/fuchsly`, dupeProjects, t)).toBe(
      "Fuchsly",
    );
    expect(tabTitle(`${BASE}/project/fuchsly-1`, dupeProjects, t)).toBe(
      "Fuchsly",
    );
  });
});
