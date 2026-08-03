import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import {
  type PERMISSIONS,
  type Permission,
  permissionsFor,
  type RoleScope,
} from "@/lib/rbac";
import { getSession } from "@/lib/session";

export type { Permission } from "@/lib/rbac";

// ─── Berechtigungsprüfung über drei Scopes ────────────────────────────────────
//
// Ein Benutzer hat je Scope höchstens eine Rolle: eine auf der Plattform, eine
// im Workspace, eine im Projekt. Die effektiven Rechte sind die Vereinigung
// aller ALLOW-Einträge abzüglich aller DENY-Einträge:
//
//     erlaubt = ⋃ ALLOW(Rollen)  \  ⋃ DENY(Rollen)
//
// Ein DENY sticht also immer, egal aus welchem Scope es kommt. Weil die
// Vereinigung für sich genommen nie etwas wegnimmt, drücken einschränkende
// Rollen ihre Grenzen ausdrücklich per DENY aus (siehe lib/rbac/roles.ts).
//
// Ein Permission-Key nennt nur Objekt und Aktion. Dass `issue.create` in einer
// Workspace-Rolle für alle Projekte gilt und in einer Projektrolle nur für
// dieses, ergibt sich allein daraus, an welcher Rolle er hängt — hier ist dafür
// keine Sonderbehandlung nötig.

// ─── Kontext ──────────────────────────────────────────────────────────────────

/** Kontext einer Prüfung — genau ein Scope. */
export type PermissionContext =
  | { scope: "platform" }
  | { workspaceId: string }
  | { projectId: string };

/** Der Plattform-Kontext als Konstante, damit Call-Sites kein Literal bauen. */
export const PLATFORM = { scope: "platform" } as const;

/** Welche Kontextform zu welchem Scope gehört. */
interface ScopeContext {
  PLATFORM: { scope: "platform" };
  WORKSPACE: { workspaceId: string };
  PROJECT: { projectId: string };
}

/**
 * Der Kontext, in dem eine Permission geprüft werden darf — abgeleitet aus den
 * `scopes` der Registry. Damit folgt der Typ der Datendefinition: trägt eine
 * Permission dort `["WORKSPACE", "PROJECT"]`, sind beide Kontexte erlaubt; steht
 * nur `["WORKSPACE"]`, ist `{ projectId }` ein Kompilierfehler statt einer
 * stillen `false`-Antwort.
 */
export type ContextFor<P extends Permission> =
  ScopeContext[(typeof PERMISSIONS)[P]["scopes"][number]];

/** Wirft, wenn eine Prüfung fehlschlägt. Actions schlagen damit fehl-sicher fehl. */
export class PermissionError extends Error {
  constructor(public permission: string) {
    super(`Permission denied: ${permission}`);
    this.name = "PermissionError";
  }
}

// ─── Eingeloggter User ─────────────────────────────────────────────────────────

/** User-Id der aktuellen Session, oder null. */
export async function currentUserId(): Promise<string | null> {
  return (await getSession())?.userId ?? null;
}

async function requireUserId(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw new PermissionError("auth.required");
  return userId;
}

// ─── Cached DB-Lookups (pro Request dedupliziert) ─────────────────────────────

const roleSelect = {
  key: true,
  rank: true,
  permissions: { select: { permissionKey: true, effect: true } },
} as const;

type GrantRow = { permissionKey: string; effect: "ALLOW" | "DENY" };
type RoleWithGrants = { key: string; rank: number; permissions: GrantRow[] };

const loadPlatformRole = cache(
  async (userId: string): Promise<RoleWithGrants | null> => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { platformRole: { select: roleSelect } },
    });
    return user?.platformRole ?? null;
  },
);

const loadWorkspaceRole = cache(
  async (
    workspaceId: string,
    userId: string,
  ): Promise<{ pending: boolean; role: RoleWithGrants } | null> => {
    return db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { pending: true, role: { select: roleSelect } },
    });
  },
);

const loadWorkspaceMeta = cache(async (workspaceId: string) => {
  return db.workspace.findUnique({
    where: { id: workspaceId },
    select: { suspended: true },
  });
});

const loadProjectMeta = cache(async (projectId: string) => {
  return db.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true, visibility: true },
  });
});

const loadProjectRole = cache(
  async (
    projectId: string,
    userId: string,
  ): Promise<{ role: RoleWithGrants } | null> => {
    return db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: { select: roleSelect } },
    });
  },
);

// ─── Ergebnis ─────────────────────────────────────────────────────────────────

/** Welche Rechte gelten, und aus welchen Rollen sie kommen. */
export interface Access {
  /** Gilt diese Permission im aufgelösten Kontext? */
  has(permission: Permission): boolean;
  /** Rang der wirksamen Rolle eines Scopes, oder -1. Kommt aus der DB. */
  rank(scope: RoleScope): number;
  /** Key der wirksamen Rolle eines Scopes, oder null. */
  roleKey(scope: RoleScope): string | null;
  workspaceId: string | null;
  projectId: string | null;
}

interface ScopeRole {
  key: string;
  rank: number;
}

function makeAccess(
  granted: Set<Permission>,
  roles: Partial<Record<RoleScope, ScopeRole>>,
  workspaceId: string | null,
  projectId: string | null,
): Access {
  return {
    has: (permission) => granted.has(permission),
    rank: (scope) => roles[scope]?.rank ?? -1,
    roleKey: (scope) => roles[scope]?.key ?? null,
    workspaceId,
    projectId,
  };
}

/** Übernimmt die Einträge einer Rolle in die ALLOW- bzw. DENY-Menge. */
function collect(
  role: RoleWithGrants | null | undefined,
  allow: Set<Permission>,
  deny: Set<Permission>,
): void {
  if (!role) return;
  for (const grant of role.permissions) {
    const permission = grant.permissionKey as Permission;
    if (grant.effect === "DENY") deny.add(permission);
    else allow.add(permission);
  }
}

function difference(
  allow: Set<Permission>,
  deny: Set<Permission>,
): Set<Permission> {
  if (deny.size === 0) return allow;
  return new Set([...allow].filter((p) => !deny.has(p)));
}

function grants(role: RoleWithGrants | null, permission: Permission): boolean {
  return (
    role?.permissions.some(
      (g) => g.permissionKey === permission && g.effect === "ALLOW",
    ) ?? false
  );
}

// ─── Auflösung ────────────────────────────────────────────────────────────────

const EMPTY: Access = makeAccess(new Set(), {}, null, null);

async function resolve(
  userId: string | null,
  ctx: PermissionContext,
): Promise<Access> {
  if (!userId) return EMPTY;

  const allow = new Set<Permission>();
  const deny = new Set<Permission>();
  const roles: Partial<Record<RoleScope, ScopeRole>> = {};

  // ── Scope PLATFORM ──────────────────────────────────────────────────────────
  const platformRole = await loadPlatformRole(userId);
  if (platformRole) {
    roles.PLATFORM = { key: platformRole.key, rank: platformRole.rank };
    collect(platformRole, allow, deny);
  }

  if ("scope" in ctx) {
    return makeAccess(difference(allow, deny), roles, null, null);
  }

  // ── Kontext auflösen: welcher Workspace, welches Projekt ────────────────────
  let workspaceId: string;
  let projectId: string | null = null;
  let visibility = "public";

  if ("projectId" in ctx) {
    const project = await loadProjectMeta(ctx.projectId);
    if (!project) return EMPTY;
    workspaceId = project.workspaceId;
    projectId = ctx.projectId;
    visibility = project.visibility;
  } else {
    workspaceId = ctx.workspaceId;
  }

  // ── Support-Zugriff ─────────────────────────────────────────────────────────
  //
  // `tenant.access` ist der Generalschlüssel in fremde Workspaces. Er kann nur
  // in einer Plattform-Rolle stehen — Mandanten-Permissions sind laut Registry
  // in diesem Scope nicht vergebbar, es gibt also keinen feineren Weg. Wer ihn
  // hat, bekommt im Mandanten alles und ist von den Regeln unten ausgenommen:
  // gerade wenn ein Workspace gesperrt oder ein Projekt privat ist, muss der
  // Support hineinsehen können. `platform_admin` hat ihn bewusst NICHT.
  if (grants(platformRole, "tenant.access")) {
    const scope: RoleScope = projectId ? "PROJECT" : "WORKSPACE";
    const everything = new Set<Permission>([
      ...allow,
      ...permissionsFor(scope),
    ]);
    return makeAccess(everything, roles, workspaceId, projectId);
  }

  // ── Regel 1 & 2: gesperrt, oder noch nicht angenommen ───────────────────────
  //
  // Die Prüfung steht VOR dem Einsammeln der Mandanten-Rollen, nicht danach.
  // Nachträglich zu filtern wäre falsch: manche Permissions sind in mehreren
  // Scopes vergebbar (`workspace.delete` etwa auch auf der Plattform), und nach
  // dem Vereinigen ist nicht mehr erkennbar, aus welcher Rolle eine kam. Wer
  // hier gar nichts einsammelt, kann auch nichts Falsches behalten.
  const [workspace, membership] = await Promise.all([
    loadWorkspaceMeta(workspaceId),
    loadWorkspaceRole(workspaceId, userId),
  ]);

  if (!workspace || workspace.suspended || membership?.pending) {
    return makeAccess(difference(allow, deny), roles, workspaceId, projectId);
  }

  // ── Scope WORKSPACE ─────────────────────────────────────────────────────────
  if (membership) {
    roles.WORKSPACE = {
      key: membership.role.key,
      rank: membership.role.rank,
    };
    collect(membership.role, allow, deny);
  }

  // ── Scope PROJECT ───────────────────────────────────────────────────────────
  const projectMember = projectId
    ? await loadProjectRole(projectId, userId)
    : null;
  if (projectMember) {
    roles.PROJECT = {
      key: projectMember.role.key,
      rank: projectMember.role.rank,
    };
    collect(projectMember.role, allow, deny);
  }

  let granted = difference(allow, deny);

  // ── Regel 3: private Projekte ───────────────────────────────────────────────
  //
  // Hinein kommt nur, wer dort Mitglied ist — oder wem der Workspace
  // ausdrücklich Einblick in alle Projekte gewährt.
  if (
    projectId &&
    visibility !== "public" &&
    !projectMember &&
    !granted.has("project.view.all")
  ) {
    granted = withoutProjectRights(granted);
  }

  return makeAccess(granted, roles, workspaceId, projectId);
}

/** Alles entfernen, was in einem Projekt gilt. */
function withoutProjectRights(granted: Set<Permission>): Set<Permission> {
  const project = new Set(permissionsFor("PROJECT"));
  return new Set([...granted].filter((p) => !project.has(p)));
}

// ─── Öffentliche API ───────────────────────────────────────────────────────────

/**
 * Alle Rechte eines Benutzers in einem Kontext auf einmal.
 *
 * Für Oberflächen, die viele Flags gleichzeitig brauchen, und für Schleifen —
 * eine Auflösung statt einer Abfrage je Permission.
 */
export async function accessFor(
  userId: string | null,
  ctx: PermissionContext,
): Promise<Access> {
  return resolve(userId, ctx);
}

/** Wie `accessFor`, aber für den eingeloggten Benutzer. */
export async function getAccess(ctx: PermissionContext): Promise<Access> {
  return resolve(await currentUserId(), ctx);
}

/** Hat `userId` die Permission im gegebenen Kontext? Wirft nicht. */
export async function can<P extends Permission>(
  userId: string,
  permission: P,
  ctx: ContextFor<P>,
): Promise<boolean> {
  const access = await resolve(userId, ctx as PermissionContext);
  return access.has(permission);
}

/** Hat der eingeloggte Benutzer die Permission? Wirft nicht (false ohne Session). */
export async function hasPermission<P extends Permission>(
  permission: P,
  ctx: ContextFor<P>,
): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;
  return can(userId, permission, ctx);
}

export interface PermissionCheck<P extends Permission = Permission> {
  permission: P;
  ctx: ContextFor<P>;
  /**
   * Für `.own`-Permissions: Liste der Owner-Ids (z. B. [reporterId, assigneeId]).
   * Der Check greift nur, wenn der aktuelle User in dieser Liste steht.
   */
  ownerIds?: (string | null | undefined)[];
}

/**
 * Erfüllt, wenn mindestens einer der Checks zutrifft (für `.own`/`.any`-Paare).
 * Wirft `PermissionError`, sonst gibt es die User-Id zurück.
 *
 * Der Mapped Type über das Tupel hält jeden Eintrag für sich geprüft:
 * TypeScript leitet die Permissions aus den `permission`-Feldern ab und
 * verlangt zu jeder den passenden Kontext.
 */
export async function requirePermissionOr<T extends readonly Permission[]>(
  checks: { [K in keyof T]: PermissionCheck<T[K] & Permission> },
): Promise<string> {
  const userId = await requireUserId();
  for (const check of checks as readonly PermissionCheck[]) {
    if (check.ownerIds && !check.ownerIds.includes(userId)) continue;
    if (await can(userId, check.permission, check.ctx as never)) return userId;
  }
  const first = (checks as readonly PermissionCheck[])[0];
  throw new PermissionError(first?.permission ?? "unknown");
}

/** Verlangt eine einzelne Permission. Wirft `PermissionError`, sonst User-Id. */
export async function requirePermission<P extends Permission>(
  permission: P,
  ctx: ContextFor<P>,
): Promise<string> {
  const userId = await requireUserId();
  if (await can(userId, permission, ctx)) return userId;
  throw new PermissionError(permission);
}

// ─── Rang-Hierarchie ──────────────────────────────────────────────────────────

/**
 * Bis zu welchem Rang jemand Rollen eines Scopes vergeben darf.
 *
 * Grundregel bleibt „höchstens die eigene Rolle". Ränge sind aber nur innerhalb
 * eines Scopes vergleichbar — ein Workspace-Owner (Rang 6) und ein Project Admin
 * (Rang 4) stehen in keiner gemeinsamen Ordnung. Wer im betreffenden Scope gar
 * keine Rolle trägt, leitet seine Befugnis aus dem Scope darüber ab und ist
 * damit nach oben offen: ein Workspace-Admin ohne eigene Projektrolle darf jede
 * Projektrolle vergeben.
 */
export function assignmentCeiling(access: Access, scope: RoleScope): number {
  return access.roleKey(scope) === null
    ? Number.POSITIVE_INFINITY
    : access.rank(scope);
}

// ─── Bulk: sichtbare Projekte ─────────────────────────────────────────────────

/**
 * Die Projekte eines Workspace, die `userId` sehen darf.
 *
 * Die Sammelvariante zu `can(…, "project.view", { projectId })`: Listen und
 * Navigationen bekämen sonst eine Auflösung je Projekt. Plattform- und
 * Workspace-Scope gelten für alle Projekte gleich und werden einmal aufgelöst;
 * nur die Projektrollen kommen je Projekt dazu.
 */
export async function accessibleProjectIds(
  userId: string | null,
  workspaceId: string,
): Promise<Set<string>> {
  const visible = new Set<string>();
  if (!userId) return visible;

  const [base, projects, memberships] = await Promise.all([
    resolve(userId, { workspaceId }),
    db.project.findMany({
      where: { workspaceId },
      select: { id: true, visibility: true },
    }),
    db.projectMember.findMany({
      where: { userId, project: { workspaceId } },
      select: { projectId: true, role: { select: roleSelect } },
    }),
  ]);

  const ownRole = new Map(memberships.map((m) => [m.projectId, m.role]));
  const seesAll = base.has("project.view.all");
  const baseSeesProjects = base.has("project.view");

  for (const project of projects) {
    const role = ownRole.get(project.id);

    // Ohne eigenen Eintrag entscheidet der Workspace — bei privaten Projekten
    // nur, wenn er ausdrücklich alle sehen darf (Regel 3).
    if (!role) {
      const allowed =
        project.visibility === "public" ? baseSeesProjects : seesAll;
      if (allowed) visible.add(project.id);
      continue;
    }

    // Mit eigenem Eintrag zählt die Vereinigung beider Scopes — ein DENY in der
    // Projektrolle nimmt `project.view` auch dann weg, wenn der Workspace es gibt.
    const allow = new Set<Permission>();
    const deny = new Set<Permission>();
    collect(role, allow, deny);
    if (deny.has("project.view")) continue;
    if (allow.has("project.view") || baseSeesProjects) visible.add(project.id);
  }

  return visible;
}
