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

/** Die drei Scopes, in denen Rollen existieren. */
export type RoleScope = "PLATFORM" | "WORKSPACE" | "PROJECT";

export const ROLE_SCOPES = [
  "PLATFORM",
  "WORKSPACE",
  "PROJECT",
] as const satisfies readonly RoleScope[];

/**
 * Wirkung eines Rollen-Eintrags. Ein DENY sticht über alle Scopes hinweg jedes
 * ALLOW — siehe `lib/permissions.ts`.
 */
export type PermissionEffect = "ALLOW" | "DENY";

interface PermissionDef {
  desc: string;
  /** Scopes, in denen diese Permission vergeben werden darf. */
  scopes: readonly RoleScope[];
}

const PLATFORM_ONLY = ["PLATFORM"] as const;
const WORKSPACE_ONLY = ["WORKSPACE"] as const;
/** Wirkt im Workspace auf alle seine Projekte, oder gezielt in einem Projekt. */
const WORKSPACE_AND_PROJECT = ["WORKSPACE", "PROJECT"] as const;

export const PERMISSIONS = {
  // ── Plattform ───────────────────────────────────────────────────────────────
  "platform.access": {
    desc: "Zugang zum Plattform-Bereich (/admin)",
    scopes: PLATFORM_ONLY,
  },
  "user.manage": {
    desc: "Benutzerkonten plattformweit verwalten",
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
  "audit.view": { desc: "Audit-Log einsehen", scopes: WORKSPACE_ONLY },

  // ── Rollen ──────────────────────────────────────────────────────────────────
  "role.manage": {
    desc: "Rollen dieses Scopes definieren und Berechtigungen zuweisen",
    scopes: ROLE_SCOPES,
  },

  // ── Mitglieder ──────────────────────────────────────────────────────────────
  // Dieselben drei Permissions in beiden Scopes: im Workspace betreffen sie
  // seine Mitglieder, im Projekt dessen Projektmitglieder.
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
    scopes: WORKSPACE_AND_PROJECT,
  },
  "project.view.all": {
    desc: "Alle Projekte sehen, auch private ohne Mitgliedschaft",
    scopes: WORKSPACE_ONLY,
  },
  "project.update": {
    desc: "Projektname, Präfix und Farbe ändern",
    scopes: WORKSPACE_AND_PROJECT,
  },
  "project.delete": {
    desc: "Projekt löschen",
    scopes: WORKSPACE_AND_PROJECT,
  },

  // ── Teams ───────────────────────────────────────────────────────────────────
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
  "issue.create": { desc: "Issue erstellen", scopes: WORKSPACE_AND_PROJECT },
  "issue.update.any": {
    desc: "Beliebige Issues bearbeiten",
    scopes: WORKSPACE_AND_PROJECT,
  },
  "issue.update.own": {
    desc: "Nur eigene Issues bearbeiten (Reporter oder Assignee)",
    scopes: WORKSPACE_AND_PROJECT,
  },
  "issue.delete.any": {
    desc: "Beliebige Issues löschen",
    scopes: WORKSPACE_AND_PROJECT,
  },
  "issue.delete.own": {
    desc: "Nur eigene Issues löschen",
    scopes: WORKSPACE_AND_PROJECT,
  },
  "issue.assign": {
    desc: "Issues anderen Mitgliedern zuweisen",
    scopes: WORKSPACE_AND_PROJECT,
  },

  // ── Kommentare ──────────────────────────────────────────────────────────────
  "comment.create": {
    desc: "Kommentar zu einem Issue schreiben",
    scopes: WORKSPACE_AND_PROJECT,
  },
  "comment.delete.any": {
    desc: "Beliebige Kommentare löschen",
    scopes: WORKSPACE_AND_PROJECT,
  },
  "comment.delete.own": {
    desc: "Nur eigene Kommentare löschen",
    scopes: WORKSPACE_AND_PROJECT,
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
