// ─── RBAC: permission registry ────────────────────────────────────────────────
//
// Pure data definition — no DB access, no `server-only`, no Prisma imports.
// This file is imported by the runtime (lib/permissions.ts), by the seed
// (prisma/seed.ts), by provisioning (lib/rbac-provision.ts), and by the
// tests.
//
// A permission key names **object and action** — not the level. Where a
// permission takes effect is decided by the scope of the role that carries
// it:
//
//   label.create on a workspace role → labels across the whole workspace
//   label.create on a project role   → labels in that project
//
// That's why each permission records the scopes it may be granted in.
// `workspace.delete` on a project role would be meaningless and is blocked.
//
// This list also marks the boundary between the levels. Each context
// resolves **exactly one** role (`lib/permissions.ts`), and `collect()` only
// takes from it what the `scopes` field actually allows it to carry. A
// permission not enabled here for a scope therefore cannot take effect
// there — even if a stale row in `RolePermission` claims otherwise.
//
// Two keys deliberately cross that boundary, and only these two. They're the
// master keys with which one level unlocks the level below:
//
//   tenant.access      (PLATFORM)   → everything in every workspace and project
//   project.admin.all  (WORKSPACE)  → everything in every project of the workspace
//   project.view.all   (WORKSPACE)  → read access to every project of the workspace
//
// They're checked in the resolver before role resolution. That's exactly
// what backs the guarantee that a workspace's leadership can't be locked out
// of any of its projects: a project role is never even loaded for them.

/** The three scopes in which roles exist. */
export type RoleScope = "PLATFORM" | "WORKSPACE" | "PROJECT";

export const ROLE_SCOPES = [
  "PLATFORM",
  "WORKSPACE",
  "PROJECT",
] as const satisfies readonly RoleScope[];

interface PermissionDef {
  desc: string;
  /** Scopes in which this permission may be granted. */
  scopes: readonly RoleScope[];
}

const PLATFORM_ONLY = ["PLATFORM"] as const;
const WORKSPACE_ONLY = ["WORKSPACE"] as const;
const PROJECT_ONLY = ["PROJECT"] as const;
/**
 * For objects that genuinely exist at both levels: a workspace-wide label and
 * a project label, a workspace member and a project member. The key is the
 * same; which object is meant depends on which role carries it.
 *
 * This is not shorthand for "also applies in the project". Whatever exists
 * only in the project — issues, comments, the project itself — is
 * `PROJECT_ONLY`; otherwise a workspace role could reach past that boundary
 * and govern every project.
 */
const WORKSPACE_AND_PROJECT = ["WORKSPACE", "PROJECT"] as const;

export const PERMISSIONS = {
  // ── Platform ───────────────────────────────────────────────────────────────
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

  // ── Platform: core data and break-glass ─────────────────────────────────────
  //
  // These two separate what a platform admin panel would otherwise conflate:
  // *that* a project exists, and *what's* in it.
  //
  // `project.metadata.view` shows the shell of every project — name,
  // workspace, creator, age, state — including private ones. That's exactly
  // what's needed to reassign orphaned projects and attribute costs.
  // Content is explicitly excluded: `features/admin/queries.ts` reads no
  // issues, no comments, no attachments.
  //
  // `project.breakglass` is the way in when it has to happen — and the only
  // one. It never enrolls anyone into a project covertly: it creates an
  // ordinary membership, requires a justification, and writes both to the
  // log (`features/admin/actions.ts`). Afterward, the platform's leadership
  // appears in the project's member list like anyone else — visible to
  // everyone working there.
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

  // ── Workspace ────────────────────────────────────────────────────────────────
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
  // The same key in all three scopes, three slices of the same log: the
  // whole thing on the platform, only what happened there in the workspace,
  // only what happened there in the project. The permission doesn't set the
  // slice — the query does (`lib/audit/index.ts`).
  "audit.view": {
    desc: "Audit-Log einsehen",
    scopes: ["PLATFORM", "WORKSPACE", "PROJECT"],
  },

  // ── Roles ───────────────────────────────────────────────────────────────────
  "role.manage": {
    desc: "Rollen dieses Scopes definieren und Berechtigungen zuweisen",
    scopes: ROLE_SCOPES,
  },

  // ── Members ─────────────────────────────────────────────────────────────────
  // The same three permissions in both scopes: in the workspace they apply
  // to its members, in the project to that project's members.
  //
  // `member.view` is deliberately WORKSPACE only: it alone decides whether
  // the "Members" tab appears (`lib/nav.ts`, `getWorkspaceMembersView`). The
  // project member list doesn't depend on it — there's (still) no dedicated
  // gate for that.
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

  // ── Projects ────────────────────────────────────────────────────────────────
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
  // Without this permission, a person sees only what relates to them on the
  // dashboard (their assigned issues) — not a hidden gate, but filtered
  // rather than blocked numbers, see `getProjectDashboard` /
  // `getWorkspaceDashboard`.
  "dashboard.view.all": {
    desc: "Sieht die Dashboard-Zahlen des ganzen Projekts bzw. Workspace, nicht nur die eigenen",
    scopes: WORKSPACE_AND_PROJECT,
  },

  // ── Teams ───────────────────────────────────────────────────────────────────
  //
  // Without this permission, you only see the teams you're a member of
  // yourself (`getWorkspaceTeamsView`) — not a hidden gate, but a filtered
  // rather than empty list, unlike `member.view` for the members tab.
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
  // An issue always lives in a project — there's no workspace-wide issue.
  // Setting status and priority is covered by `issue.update.*`; which
  // statuses and priorities exist at all is governed by `config.manage` in
  // the workspace.
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

  // ── Comments ────────────────────────────────────────────────────────────────
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

/** Human-readable description of a permission. */
export function permissionDesc(permission: Permission): string {
  return PERMISSIONS[permission].desc;
}

/** May a role of this scope carry the permission? */
export function isPermissionAllowedIn(
  permission: Permission,
  scope: RoleScope,
): boolean {
  return (PERMISSIONS[permission].scopes as readonly RoleScope[]).includes(
    scope,
  );
}

/** All permissions that a role of this scope may carry. */
export function permissionsFor(scope: RoleScope): Permission[] {
  return ALL_PERMISSIONS.filter((p) => isPermissionAllowedIn(p, scope));
}

/** Narrows an arbitrary (DB) string to the `Permission` union. */
export function toPermission(value: string): Permission | null {
  return value in PERMISSIONS ? (value as Permission) : null;
}

/** Narrows an arbitrary (DB) string to the `RoleScope` union. */
export function toRoleScope(value: string): RoleScope | null {
  return (ROLE_SCOPES as readonly string[]).includes(value)
    ? (value as RoleScope)
    : null;
}
