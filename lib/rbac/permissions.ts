// ─── RBAC: Permission-Registry ────────────────────────────────────────────────
//
// Reine Datendefinition — kein DB-Zugriff, kein `server-only`, keine Prisma-
// Importe. Diese Datei wird von der Runtime (lib/permissions.ts), vom Seed
// (prisma/seed.ts), von der Provisionierung (lib/rbac-provision.ts) und von den
// Tests importiert.
//
// Ein Permission-Key nennt **Objekt und Aktion** — nicht die Ebene. Wo eine
// Permission wirkt, entscheidet der Scope der Rolle, die sie trägt:
//
//   label.create in einer Workspace-Rolle → Labels im ganzen Workspace
//   label.create in einer Projektrolle    → Labels in diesem Projekt
//
// Deshalb steht bei jeder Permission, in welchen Scopes sie vergeben werden
// darf. `workspace.delete` in einer Projektrolle wäre sinnlos und ist gesperrt.
//
// Diese Liste ist zugleich die Grenze zwischen den Ebenen. Jeder Kontext löst
// **genau eine** Rolle auf (`lib/permissions.ts`), und `collect()` nimmt aus ihr
// nur, was sie laut `scopes` überhaupt tragen darf. Eine Permission, die hier
// nicht für einen Scope freigegeben ist, kann dort also gar nicht wirken — auch
// dann nicht, wenn eine alte Zeile in `RolePermission` das Gegenteil behauptet.
//
// Zwei Keys durchbrechen die Trennung bewusst, und nur sie. Es sind die
// Generalschlüssel, mit denen eine Ebene die darunter aufschließt:
//
//   tenant.access      (PLATFORM)   → alles in jedem Workspace und Projekt
//   project.admin.all  (WORKSPACE)  → alles in jedem Projekt des Workspace
//   project.view.all   (WORKSPACE)  → lesend in jedes Projekt des Workspace
//
// Sie stehen im Resolver vor der Rollenauflösung. Genau daran hängt die Zusage,
// dass die Leitung eines Workspace sich aus keinem seiner Projekte aussperren
// lässt: eine Projektrolle wird für sie gar nicht erst geladen.

/** Die drei Scopes, in denen Rollen existieren. */
export type RoleScope = "PLATFORM" | "WORKSPACE" | "PROJECT";

export const ROLE_SCOPES = [
  "PLATFORM",
  "WORKSPACE",
  "PROJECT",
] as const satisfies readonly RoleScope[];

interface PermissionDef {
  desc: string;
  /** Scopes, in denen diese Permission vergeben werden darf. */
  scopes: readonly RoleScope[];
}

const PLATFORM_ONLY = ["PLATFORM"] as const;
const WORKSPACE_ONLY = ["WORKSPACE"] as const;
const PROJECT_ONLY = ["PROJECT"] as const;
/**
 * Für Objekte, die es auf beiden Ebenen wirklich gibt: einen workspaceweiten
 * Label und einen Projekt-Label, ein Workspace-Mitglied und ein Projekt-Mitglied.
 * Der Key ist derselbe, gemeint ist je nach tragender Rolle ein anderes Objekt.
 *
 * Das ist keine Abkürzung für „gilt auch im Projekt". Was es nur im Projekt gibt
 * — Issues, Kommentare, das Projekt selbst — steht auf `PROJECT_ONLY`, sonst
 * könnte eine Workspace-Rolle daran vorbei in jedes Projekt hineinregieren.
 */
const WORKSPACE_AND_PROJECT = ["WORKSPACE", "PROJECT"] as const;

export const PERMISSIONS = {
  // ── Plattform ───────────────────────────────────────────────────────────────
  "platform.access": {
    desc: "Zugang zum Plattform-Bereich (/admin)",
    scopes: PLATFORM_ONLY,
  },
  "user.manage": {
    desc: "Benutzerkonten plattformweit verwalten: Plattform-Rolle setzen, Konten stilllegen",
    scopes: PLATFORM_ONLY,
  },
  "tenant.access": {
    desc: "Inhalte aller Workspaces einsehen und bearbeiten (Support-Zugriff)",
    scopes: PLATFORM_ONLY,
  },
  "workspace.suspend": {
    desc: "Workspaces sperren und entsperren",
    scopes: PLATFORM_ONLY,
  },
  "mail.template.manage": {
    desc: "Betreff, Überschrift und Einleitungstext der Mail-Vorlagen bearbeiten",
    scopes: PLATFORM_ONLY,
  },

  // ── Plattform: Stammdaten und Notfall ───────────────────────────────────────
  //
  // Diese beiden trennen, was in einer Plattformverwaltung sonst gern
  // zusammenfällt: *dass* es ein Projekt gibt, und *was* darin steht.
  //
  // `project.metadata.view` zeigt die Hülle jedes Projekts — Name, Workspace,
  // Ersteller, Alter, Zustand — auch die privater. Genau das braucht, wer
  // verwaiste Projekte neu zuordnen und Kosten zurechnen muss. Inhalte fallen
  // ausdrücklich nicht darunter: `features/admin/queries.ts` liest keine Issues,
  // keine Kommentare, keine Anhänge.
  //
  // `project.breakglass` ist der Weg hinein, wenn es sein muss — und nur dieser.
  // Er trägt niemanden heimlich in ein Projekt: er legt eine gewöhnliche
  // Mitgliedschaft an, verlangt eine Begründung und schreibt beides ins
  // Protokoll (`features/admin/actions.ts`). Danach steht die Plattformleitung
  // in der Mitgliederliste des Projekts wie jeder andere auch — sichtbar für
  // alle, die dort arbeiten.
  "project.metadata.view": {
    desc: "Stammdaten aller Projekte sehen, auch privater — ohne deren Inhalte",
    scopes: PLATFORM_ONLY,
  },
  "project.metadata.manage": {
    desc: "Stammdaten eines Projekts ändern: Besitzer neu zuordnen, stilllegen — weiterhin ohne Blick hinein",
    scopes: PLATFORM_ONLY,
  },
  "project.breakglass": {
    desc: "Notfall-Zugriff: sich selbst mit Begründung in ein fremdes Projekt eintragen (wird protokolliert)",
    scopes: PLATFORM_ONLY,
  },

  // ── Workspace ───────────────────────────────────────────────────────────────
  "workspace.update": {
    desc: "Name, Farbe und Slug des Workspace ändern",
    scopes: WORKSPACE_ONLY,
  },
  "workspace.delete": {
    desc: "Workspace unwiderruflich löschen",
    scopes: ["PLATFORM", "WORKSPACE"],
  },
  "config.manage": {
    desc: "Status, Prioritäten und Issue-Typen verwalten",
    scopes: WORKSPACE_ONLY,
  },
  // Derselbe Key in allen drei Scopes, drei Ausschnitte desselben Protokolls:
  // auf der Plattform das ganze, im Workspace nur, was dort geschah, im
  // Projekt nur, was dort geschah. Den Ausschnitt setzt nicht die Permission,
  // sondern die Abfrage (`lib/audit/index.ts`).
  "audit.view": {
    desc: "Audit-Log einsehen",
    scopes: ["PLATFORM", "WORKSPACE", "PROJECT"],
  },

  // ── Rollen ──────────────────────────────────────────────────────────────────
  "role.manage": {
    desc: "Rollen dieses Scopes definieren und Berechtigungen zuweisen",
    scopes: ROLE_SCOPES,
  },

  // ── Mitglieder ──────────────────────────────────────────────────────────────
  // Dieselben drei Permissions in beiden Scopes: im Workspace betreffen sie
  // seine Mitglieder, im Projekt dessen Projektmitglieder.
  //
  // `member.view` ist bewusst nur WORKSPACE: sie entscheidet allein, ob der
  // Tab "Mitglieder" erscheint (`lib/nav.ts`, `getWorkspaceMembersView`). Die
  // Projekt-Mitgliederliste hängt daran nicht — dafür gibt es (noch) kein
  // eigenes Gate.
  "member.view": {
    desc: "Die Mitgliederliste des Workspace sehen",
    scopes: WORKSPACE_ONLY,
  },
  "member.invite": {
    desc: "Mitglieder hinzufügen und einladen",
    scopes: WORKSPACE_AND_PROJECT,
  },
  "member.remove": {
    desc: "Mitglieder entfernen",
    scopes: WORKSPACE_AND_PROJECT,
  },
  "member.role.update": {
    desc: "Rolle eines anderen Mitglieds ändern",
    scopes: WORKSPACE_AND_PROJECT,
  },

  // ── Projekte ────────────────────────────────────────────────────────────────
  "project.create": {
    desc: "Neues Projekt im Workspace anlegen",
    scopes: WORKSPACE_ONLY,
  },
  "project.view": {
    desc: "Projekt sehen (relevant für private Projekte)",
    scopes: PROJECT_ONLY,
  },
  "project.view.all": {
    desc: "Alle Projekte des Workspace lesend sehen, auch ohne Mitgliedschaft",
    scopes: WORKSPACE_ONLY,
  },
  "project.admin.all": {
    desc: "In jedem Projekt des Workspace alle Rechte haben, ohne Mitglied zu sein",
    scopes: WORKSPACE_ONLY,
  },
  "project.update": {
    desc: "Projektname, Präfix und Farbe ändern",
    scopes: PROJECT_ONLY,
  },
  "project.delete": {
    desc: "Projekt löschen",
    scopes: PROJECT_ONLY,
  },

  // ── Dashboard ───────────────────────────────────────────────────────────────
  //
  // Ohne diese Permission sieht eine Person auf dem Dashboard nur, was sich auf
  // sie selbst bezieht (ihre zugewiesenen Issues) — kein verstecktes Gate,
  // sondern gefilterte statt gesperrte Zahlen, siehe `getProjectDashboard` /
  // `getWorkspaceDashboard`.
  "dashboard.view.all": {
    desc: "Sieht die Dashboard-Zahlen des ganzen Projekts bzw. Workspace, nicht nur die eigenen",
    scopes: WORKSPACE_AND_PROJECT,
  },

  // ── Teams ───────────────────────────────────────────────────────────────────
  //
  // Ohne dieses Recht sieht man nur die Teams, in denen man selbst Mitglied
  // ist (`getWorkspaceTeamsView`) — kein verstecktes Gate, sondern gefilterte
  // statt leerer Liste, anders als `member.view` beim Mitglieder-Tab.
  "team.view.all": {
    desc: "Alle Teams des Workspace sehen, nicht nur die eigenen",
    scopes: WORKSPACE_ONLY,
  },
  "team.create": { desc: "Team erstellen", scopes: WORKSPACE_ONLY },
  "team.update": {
    desc: "Team-Name, Farbe und Lead ändern",
    scopes: WORKSPACE_ONLY,
  },
  "team.delete": { desc: "Team löschen", scopes: WORKSPACE_ONLY },
  "team.member.manage": {
    desc: "Mitglieder zu Teams hinzufügen oder entfernen",
    scopes: WORKSPACE_ONLY,
  },
  "team.project.manage": {
    desc: "Projekte Teams zuordnen oder entfernen",
    scopes: WORKSPACE_ONLY,
  },

  // ── Labels ──────────────────────────────────────────────────────────────────
  "label.create": { desc: "Label anlegen", scopes: WORKSPACE_AND_PROJECT },
  "label.update": { desc: "Label bearbeiten", scopes: WORKSPACE_AND_PROJECT },
  "label.delete": { desc: "Label löschen", scopes: WORKSPACE_AND_PROJECT },

  // ── Issues ──────────────────────────────────────────────────────────────────
  //
  // Ein Issue liegt immer in einem Projekt — es gibt kein workspaceweites Issue.
  // Status und Priorität zu setzen steckt in `issue.update.*`; welche Status und
  // Prioritäten es überhaupt gibt, regelt `config.manage` im Workspace.
  "issue.create": { desc: "Issue erstellen", scopes: PROJECT_ONLY },
  "issue.update.any": {
    desc: "Beliebige Issues bearbeiten (Status, Priorität, Labels, Text)",
    scopes: PROJECT_ONLY,
  },
  "issue.update.own": {
    desc: "Nur eigene Issues bearbeiten (Reporter oder Assignee)",
    scopes: PROJECT_ONLY,
  },
  "issue.delete.any": {
    desc: "Beliebige Issues löschen",
    scopes: PROJECT_ONLY,
  },
  "issue.delete.own": {
    desc: "Nur eigene Issues löschen",
    scopes: PROJECT_ONLY,
  },
  "issue.assign": {
    desc: "Issues anderen Mitgliedern zuweisen",
    scopes: PROJECT_ONLY,
  },
  "issue.share.manage": {
    desc: "Öffentlichen Lese-Link für ein Issue erstellen und widerrufen",
    scopes: PROJECT_ONLY,
  },

  // ── Kommentare ──────────────────────────────────────────────────────────────
  "comment.create": {
    desc: "Kommentar zu einem Issue schreiben",
    scopes: PROJECT_ONLY,
  },
  "comment.delete.any": {
    desc: "Beliebige Kommentare löschen",
    scopes: PROJECT_ONLY,
  },
  "comment.delete.own": {
    desc: "Nur eigene Kommentare löschen",
    scopes: PROJECT_ONLY,
  },
  "comment.update.any": {
    desc: "Beliebige Kommentare bearbeiten",
    scopes: PROJECT_ONLY,
  },
  "comment.update.own": {
    desc: "Nur eigene Kommentare bearbeiten",
    scopes: PROJECT_ONLY,
  },
  "comment.react": {
    desc: "Auf Kommentare reagieren",
    scopes: PROJECT_ONLY,
  },
} as const satisfies Record<string, PermissionDef>;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Menschlich lesbare Beschreibung einer Permission. */
export function permissionDesc(permission: Permission): string {
  return PERMISSIONS[permission].desc;
}

/** Darf eine Rolle dieses Scopes die Permission tragen? */
export function isPermissionAllowedIn(
  permission: Permission,
  scope: RoleScope,
): boolean {
  return (PERMISSIONS[permission].scopes as readonly RoleScope[]).includes(
    scope,
  );
}

/** Alle Permissions, die eine Rolle dieses Scopes tragen darf. */
export function permissionsFor(scope: RoleScope): Permission[] {
  return ALL_PERMISSIONS.filter((p) => isPermissionAllowedIn(p, scope));
}

/** Narrowt einen beliebigen (DB-)String auf die `Permission`-Union. */
export function toPermission(value: string): Permission | null {
  return value in PERMISSIONS ? (value as Permission) : null;
}

/** Narrowt einen beliebigen (DB-)String auf die `RoleScope`-Union. */
export function toRoleScope(value: string): RoleScope | null {
  return (ROLE_SCOPES as readonly string[]).includes(value)
    ? (value as RoleScope)
    : null;
}
