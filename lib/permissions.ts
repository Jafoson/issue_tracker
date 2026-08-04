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
// im Workspace (`WorkspaceMember`), eine je Projekt (`ProjectMember`). Gefragt
// wird die Ebene, um die es geht:
//
//     Workspace-Kontext:  Plattform ∪ Workspace
//     Projekt-Kontext:    Plattform ∪ Workspace(ohne Projektrechte) ∪ Projektrolle
//
// Im Projekt entscheidet also die Projektrolle. Sie ergänzt die Workspace-Rolle
// nicht, sondern ersetzt sie für alles, was ein Projekt betrifft: keine Zeile in
// `ProjectMember` heißt keine Projektrechte. Was allein workspaceweit gilt
// (`project.create`, `project.view.all`, `team.*` …) bleibt unberührt — eine
// Projektrolle kann diese Keys laut Registry gar nicht tragen.
//
// Von jedem Ergebnis gehen die DENY-Einträge aller Ebenen ab:
//
//     erlaubt = ALLOW(zuständige Ebenen)  \  ⋃ DENY(alle Ebenen)
//
// Ein DENY sticht also immer. Die Feinheiten stehen bei `projectGrants` und
// `keepsProjectRights`.
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

// `visibility` steht hier bewusst nicht: über den Zugriff entscheidet allein die
// Projektrolle. Die Sichtbarkeit legt nur fest, wer beim Anlegen eines Projekts
// automatisch eingetragen wird (lib/project-membership.ts).
const loadProjectMeta = cache(async (projectId: string) => {
  return db.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
});

/**
 * Die **eigene** Projektrolle, oder null.
 *
 * In `ProjectMember` steht jeder, der im Projekt ist. Eine Zeile ohne `roleId`
 * hält nur diese Zugehörigkeit fest — die Rechte kommen dann allein aus dem
 * Workspace, und für die Auswertung ist sie so gut wie keine Zeile.
 */
const loadProjectRole = cache(
  async (projectId: string, userId: string): Promise<RoleWithGrants | null> => {
    const member = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: { select: roleSelect } },
    });
    return member?.role ?? null;
  },
);

/** Steht die Person in mindestens einem Projekt dieses Workspace? */
const inAnyProject = cache(
  async (userId: string, workspaceId: string): Promise<boolean> => {
    const row = await db.projectMember.findFirst({
      where: { userId, project: { workspaceId } },
      select: { projectId: true },
    });
    return row !== null;
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

/** Alle Permissions, die eine Projektrolle tragen kann. */
const PROJECT_SCOPED = new Set<Permission>(permissionsFor("PROJECT"));

/** Was die Ebenen über dem Projekt hergeben. */
interface Base {
  allow: Set<Permission>;
  deny: Set<Permission>;
  roles: Partial<Record<RoleScope, ScopeRole>>;
  /** `tenant.access`: Support-Generalschlüssel, hebt alle Regeln auf. */
  master: boolean;
  /** Workspace gesperrt oder Einladung offen — aus dem Mandanten kommt nichts. */
  closed: boolean;
}

/**
 * Plattform- und Workspace-Ebene einsammeln.
 *
 * Beide Kontexte brauchen das: die Workspace-Prüfung als Ergebnis, die
 * Projekt-Prüfung als Unterlage. Deshalb steht es hier für sich.
 */
async function loadBase(userId: string, workspaceId: string): Promise<Base> {
  const allow = new Set<Permission>();
  const deny = new Set<Permission>();
  const roles: Partial<Record<RoleScope, ScopeRole>> = {};

  // ── Scope PLATFORM ──────────────────────────────────────────────────────────
  const platformRole = await loadPlatformRole(userId);
  if (platformRole) {
    roles.PLATFORM = { key: platformRole.key, rank: platformRole.rank };
    collect(platformRole, allow, deny);
  }

  // ── Support-Zugriff ─────────────────────────────────────────────────────────
  //
  // `tenant.access` ist der Generalschlüssel in fremde Workspaces. Er kann nur
  // in einer Plattform-Rolle stehen — Mandanten-Permissions sind laut Registry
  // in diesem Scope nicht vergebbar, es gibt also keinen feineren Weg. Wer ihn
  // hat, bekommt im Mandanten alles und ist von den Regeln unten ausgenommen:
  // gerade wenn ein Workspace gesperrt oder ein Projekt privat ist, muss der
  // Support hineinsehen können. `platform_admin` hat ihn bewusst NICHT.
  if (grants(platformRole, "tenant.access"))
    return { allow, deny, roles, master: true, closed: false };

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

  if (!workspace || workspace.suspended || membership?.pending)
    return { allow, deny, roles, master: false, closed: true };

  // ── Scope WORKSPACE ─────────────────────────────────────────────────────────
  if (membership) {
    roles.WORKSPACE = { key: membership.role.key, rank: membership.role.rank };
    collect(membership.role, allow, deny);
  }

  return { allow, deny, roles, master: false, closed: false };
}

/**
 * Wer jedes Projekt sehen darf (Owner, Admin), lässt sich per Projektrolle nicht
 * herabstufen.
 *
 * Ohne diese Ausnahme könnte ein Project Admin die Leitung des Workspace aus
 * deren eigenem Projekt aussperren — und niemand käme mehr an dessen
 * Mitgliederverwaltung heran. Die Oberfläche verspricht das ohnehin schon
 * (`getProjectMembersView`), hier steht es durchgesetzt.
 */
function keepsProjectRights(base: Base): boolean {
  return difference(base.allow, base.deny).has("project.view.all");
}

/**
 * Die Rechte in einem Projekt.
 *
 * Hier entscheidet die Projektrolle: sie **ersetzt** die projektbezogenen Rechte
 * der Workspace-Rolle, statt sie zu ergänzen. Was jemand in diesem Projekt darf,
 * steht in `ProjectMember` — was er im Workspace darf, in `WorkspaceMember`. Ohne
 * Zeile in `ProjectMember` gibt es also keine Projektrechte, auch nicht bei einem
 * öffentlichen Projekt.
 *
 * Unberührt davon bleiben die Rechte, die nur workspaceweit gelten
 * (`project.create`, `project.view.all`, `team.*` …) — eine Projektrolle kann sie
 * gar nicht tragen, also kann sie sie auch nicht ersetzen.
 *
 * Ein DENY der oberen Ebenen bleibt ein DENY: eine Projektrolle hebelt kein
 * workspaceweites Verbot aus, sonst wäre das Verbot wertlos.
 */
function projectGrants(
  base: Base,
  projectRole: RoleWithGrants | null,
): Set<Permission> {
  if (keepsProjectRights(base)) return difference(base.allow, base.deny);

  const allow = new Set<Permission>(
    [...base.allow].filter((p) => !PROJECT_SCOPED.has(p)),
  );
  const deny = new Set(base.deny);
  collect(projectRole, allow, deny);

  return difference(allow, deny);
}

async function resolve(
  userId: string | null,
  ctx: PermissionContext,
): Promise<Access> {
  if (!userId) return EMPTY;

  // ── Kontext PLATFORM ────────────────────────────────────────────────────────
  if ("scope" in ctx) {
    const platformRole = await loadPlatformRole(userId);
    const allow = new Set<Permission>();
    const deny = new Set<Permission>();
    const roles: Partial<Record<RoleScope, ScopeRole>> = {};
    if (platformRole) {
      roles.PLATFORM = { key: platformRole.key, rank: platformRole.rank };
      collect(platformRole, allow, deny);
    }
    return makeAccess(difference(allow, deny), roles, null, null);
  }

  // ── Kontext WORKSPACE ───────────────────────────────────────────────────────
  if (!("projectId" in ctx)) {
    const base = await loadBase(userId, ctx.workspaceId);
    const granted = base.master
      ? new Set<Permission>([...base.allow, ...permissionsFor("WORKSPACE")])
      : difference(base.allow, base.deny);
    return makeAccess(granted, base.roles, ctx.workspaceId, null);
  }

  // ── Kontext PROJECT ─────────────────────────────────────────────────────────
  const project = await loadProjectMeta(ctx.projectId);
  if (!project) return EMPTY;

  const base = await loadBase(userId, project.workspaceId);
  const where = [project.workspaceId, ctx.projectId] as const;

  if (base.master) {
    const everything = new Set<Permission>([
      ...base.allow,
      ...permissionsFor("PROJECT"),
    ]);
    return makeAccess(everything, base.roles, ...where);
  }
  if (base.closed)
    return makeAccess(difference(base.allow, base.deny), base.roles, ...where);

  const projectRole = await loadProjectRole(ctx.projectId, userId);
  // Der Rang der Projektrolle bindet nur, wenn sie auch entscheidet. Wer nicht
  // herabstufbar ist, bleibt beim Rollenvergeben nach oben offen — sonst könnte
  // er die eigene Herabstufung nicht zurücknehmen.
  if (projectRole && !keepsProjectRights(base))
    base.roles.PROJECT = { key: projectRole.key, rank: projectRole.rank };

  return makeAccess(projectGrants(base, projectRole), base.roles, ...where);
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

// ─── Zutritt zum Mandanten ────────────────────────────────────────────────────

/**
 * Darf jemand den Workspace überhaupt betreten?
 *
 * Es gibt dafür keinen Permission-Key: Zutritt hat, wer dazugehört. Drei Wege
 * führen hinein, und keiner davon ist eine Permission —
 *
 *   1. `tenant.access` (Support-Generalschlüssel),
 *   2. eine angenommene Mitgliedschaft im Workspace,
 *   3. eine Projektmitgliedschaft, ohne im Workspace zu sein (Projekt-Gast).
 *
 * Weg 3 ist der Grund, warum eine reine `WorkspaceMember`-Abfrage hier nicht
 * genügt: ein Gast ist ausdrücklich zu genau einem Projekt eingeladen und würde
 * sonst aus der Hülle ausgesperrt, in der dieses Projekt liegt.
 *
 * Eine offene Einladung zählt nicht: `loadBase` gibt einer solchen Zeile keine
 * Rechte, die Seiten wären also ohnehin leer.
 */
export const canEnterWorkspace = cache(
  async (userId: string | null, workspaceId: string): Promise<boolean> => {
    if (!userId) return false;
    const base = await loadBase(userId, workspaceId);
    if (base.master) return true;
    if (base.closed) return false;
    if (base.roles.WORKSPACE) return true;
    return inAnyProject(userId, workspaceId);
  },
);

/** Wie `canEnterWorkspace`, aber für den eingeloggten Benutzer. */
export async function currentUserCanEnterWorkspace(
  workspaceId: string,
): Promise<boolean> {
  return canEnterWorkspace(await currentUserId(), workspaceId);
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
 * Workspace-Ebene gelten für alle Projekte gleich und werden einmal aufgelöst;
 * die Projektrolle kommt je Projekt dazu und entscheidet — dieselbe Regel wie in
 * `projectGrants`, nur über alle Projekte auf einmal.
 */
export const accessibleProjectIds = cache(async function accessibleProjectIds(
  userId: string | null,
  workspaceId: string,
): Promise<Set<string>> {
  const visible = new Set<string>();
  if (!userId) return visible;

  const [base, projects, memberships] = await Promise.all([
    loadBase(userId, workspaceId),
    db.project.findMany({ where: { workspaceId }, select: { id: true } }),
    db.projectMember.findMany({
      where: { userId, project: { workspaceId } },
      select: { projectId: true, role: { select: roleSelect } },
    }),
  ]);

  // Support und die Leitung des Workspace sehen jedes Projekt, auch ohne Rolle
  // darin (Ausnahme 2 in `projectGrants`).
  if (
    base.master ||
    difference(base.allow, base.deny).has("project.view.all")
  ) {
    for (const project of projects) visible.add(project.id);
    return visible;
  }
  if (base.closed) return visible;

  const ownRole = new Map(memberships.map((m) => [m.projectId, m.role]));

  for (const project of projects) {
    // Keine Projektrolle heißt kein Zugriff — `ProjectMember` ist die Liste,
    // wer im Projekt ist.
    const role = ownRole.get(project.id);
    if (!role) continue;
    if (projectGrants(base, role).has("project.view")) visible.add(project.id);
  }

  return visible;
});

/** Wie `accessibleProjectIds`, aber für den eingeloggten Benutzer. */
export async function visibleProjectIds(
  workspaceId: string,
): Promise<Set<string>> {
  return accessibleProjectIds(await currentUserId(), workspaceId);
}
