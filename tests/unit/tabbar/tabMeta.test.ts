import { describe, expect, it } from "bun:test";

import {
  tabColor,
  tabIcon,
  tabMeta,
  tabTitle,
  workspaceIdFromPath,
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
  "nav.labels": "Labels",
  "nav.account": "Konto",
  "nav.appearance": "Aussehen",
  "nav.notifications": "Benachrichtigungen",
  "nav.security": "Sicherheit",
  "nav.connections": "Verbundene Konten",
  "nav.overview": "Übersicht",
  "nav.users": "Benutzer",
  "nav.workspaces": "Workspaces",
  "nav.audit": "Protokoll",
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

  it("nutzt das Mitglieder-Icon für die Mitglieder-Ansicht eines Projekts", () => {
    expect(tabIcon(`${BASE}/project/fuchsly/members`)).toBe("lucide:users");
  });

  it("nutzt das Zahnrad für den Kopf der Projekteinstellungen", () => {
    expect(tabIcon(`${BASE}/project/fuchsly/settings`)).toBe("lucide:settings");
  });

  it("nutzt das Icon des jeweiligen Einstellungs-Bereichs", () => {
    expect(tabIcon(`${BASE}/project/fuchsly/settings/roles`)).toBe(
      "lucide:shield-check",
    );
    expect(tabIcon(`${BASE}/project/fuchsly/settings/labels`)).toBe(
      "lucide:tag",
    );
  });

  it("fällt für unbekannte Einstellungs-Bereiche aufs Zahnrad zurück", () => {
    expect(tabIcon(`${BASE}/project/fuchsly/settings/gibtsnicht`)).toBe(
      "lucide:settings",
    );
  });

  it("fällt für unbekannte Unterseiten aufs Board-Icon zurück", () => {
    expect(tabIcon(`${BASE}/project/fuchsly/gibtsnicht`)).toBe(
      "lucide:layout-dashboard",
    );
  });
});

describe("Admin-Routen", () => {
  it("mappt /admin auf die Übersicht", () => {
    expect(tabTitle("/admin", projects, t)).toBe("Übersicht");
    expect(tabIcon("/admin")).toBe("lucide:layout-dashboard");
  });

  it("mappt /admin/users", () => {
    expect(tabTitle("/admin/users", projects, t)).toBe("Benutzer");
    expect(tabIcon("/admin/users")).toBe("lucide:users");
  });

  it("mappt /admin/workspaces", () => {
    expect(tabTitle("/admin/workspaces", projects, t)).toBe("Workspaces");
    expect(tabIcon("/admin/workspaces")).toBe("lucide:building-2");
  });

  it("mappt /admin/projects", () => {
    expect(tabTitle("/admin/projects", projects, t)).toBe("Projekte");
    expect(tabIcon("/admin/projects")).toBe("lucide:folders");
  });

  it("mappt /admin/audit", () => {
    expect(tabTitle("/admin/audit", projects, t)).toBe("Protokoll");
    expect(tabIcon("/admin/audit")).toBe("lucide:scroll-text");
  });

  it("mappt /admin/roles", () => {
    expect(tabTitle("/admin/roles", projects, t)).toBe("Rollen & Rechte");
    expect(tabIcon("/admin/roles")).toBe("lucide:shield-check");
  });

  it("hat für Admin nie eine Projektfarbe", () => {
    expect(tabColor("/admin", projects)).toBeNull();
    expect(tabColor("/admin/users", projects)).toBeNull();
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

  it("hängt das (Mitglieder)-Suffix bei der Mitglieder-Ansicht an", () => {
    expect(tabMeta(`${BASE}/project/fuchsly/members`, projects, t).title).toBe(
      "Fuchsly (Mitglieder)",
    );
  });

  it("hängt (Einstellungen) an den Kopf der Projekteinstellungen an", () => {
    expect(tabMeta(`${BASE}/project/fuchsly/settings`, projects, t).title).toBe(
      "Fuchsly (Einstellungen)",
    );
  });

  // Beide Bereiche liegen unter /settings. Trügen sie dasselbe Suffix, wären
  // nebeneinander liegende Reiter nicht auseinanderzuhalten.
  it("nennt den Bereich statt (Einstellungen), sobald es einen gibt", () => {
    expect(
      tabMeta(`${BASE}/project/fuchsly/settings/roles`, projects, t).title,
    ).toBe("Fuchsly (Rollen & Rechte)");
    expect(
      tabMeta(`${BASE}/project/fuchsly/settings/labels`, projects, t).title,
    ).toBe("Fuchsly (Labels)");
  });

  it("fällt für einen unbekannten Bereich auf (Einstellungen) zurück", () => {
    expect(
      tabMeta(`${BASE}/project/fuchsly/settings/gibtsnicht`, projects, t).title,
    ).toBe("Fuchsly (Einstellungen)");
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

// „Meine Aufgaben" haben dieselben zwei Ansichten wie ein Projekt. Ohne eigene
// Behandlung hießen beide Reiter gleich und trügen dasselbe Zeichen.
describe("Meine Aufgaben", () => {
  it("lässt das Board unverändert", () => {
    const meta = tabMeta(`${BASE}/my?status=todo`, projects, t);
    expect(meta.title).toBe("Meine Aufgaben");
    expect(meta.icon).toBe("lucide:user");
  });

  it("nennt die Liste im Suffix und zeigt deren Zeichen", () => {
    const meta = tabMeta(`${BASE}/my/list`, projects, t);
    expect(meta.title).toBe("Meine Aufgaben (Aufgaben)");
    expect(meta.icon).toBe("lucide:list");
  });
});

// Die eigenen Einstellungen liegen unter /<workspace>/account. Der Bereich
// gehört keinem Workspace, hängt aber unter einem — ohne eigene Behandlung hießen
// alle fünf Reiter „Konto" und trügen dasselbe Zeichen.
describe("Konto-Routen", () => {
  it("nennt den Kopf 'Konto' und zeigt das Personen-Zeichen", () => {
    expect(tabTitle(`${BASE}/account`, projects, t)).toBe("Konto");
    expect(tabIcon(`${BASE}/account`)).toBe("lucide:user");
    expect(tabMeta(`${BASE}/account`, projects, t).title).toBe("Konto");
  });

  it("nennt den Bereich, sobald es einen gibt", () => {
    expect(tabMeta(`${BASE}/account/appearance`, projects, t).title).toBe(
      "Konto (Aussehen)",
    );
    expect(tabMeta(`${BASE}/account/security`, projects, t).title).toBe(
      "Konto (Sicherheit)",
    );
    expect(tabMeta(`${BASE}/account/connections`, projects, t).title).toBe(
      "Konto (Verbundene Konten)",
    );
  });

  it("gibt jedem Bereich sein eigenes Zeichen", () => {
    expect(tabIcon(`${BASE}/account/appearance`)).toBe("lucide:palette");
    expect(tabIcon(`${BASE}/account/notifications`)).toBe("lucide:bell");
    expect(tabIcon(`${BASE}/account/security`)).toBe("lucide:shield-check");
    expect(tabIcon(`${BASE}/account/connections`)).toBe("lucide:link");
  });

  it("fällt für einen unbekannten Bereich auf Konto zurück", () => {
    expect(tabMeta(`${BASE}/account/gibtsnicht`, projects, t).title).toBe(
      "Konto",
    );
    expect(tabIcon(`${BASE}/account/gibtsnicht`)).toBe("lucide:circle-user");
  });

  it("hat nie eine Projektfarbe", () => {
    expect(tabColor(`${BASE}/account`, projects)).toBeNull();
    expect(tabMeta(`${BASE}/account/security`, projects, t).icon).toBe(
      "lucide:shield-check",
    );
  });
});

describe("workspaceIdFromPath()", () => {
  it("liefert die Workspace-ID für Workspace-Routen", () => {
    expect(workspaceIdFromPath(`${BASE}/my`)).toBe("fuchsly");
    expect(workspaceIdFromPath(`${BASE}/project/fuchsly/list`)).toBe("fuchsly");
  });

  it("liefert null für Admin-Routen", () => {
    expect(workspaceIdFromPath("/admin")).toBeNull();
    expect(workspaceIdFromPath("/admin/members")).toBeNull();
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
