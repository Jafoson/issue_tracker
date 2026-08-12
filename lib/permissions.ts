import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  isPermissionAllowedIn,
  type PERMISSIONS,
  type Permission,
  permissionsFor,
  type RoleScope,
  toPermission,
} from "@/lib/rbac";
import { getSession } from "@/lib/session";

export type { Permission } from "@/lib/rbac";

// ─── Berechtigungsprüfung über drei Scopes ────────────────────────────────────
//
// Ein Benutzer hat je Scope höchstens eine Rolle: eine auf der Plattform, eine
// im Workspace (`WorkspaceMember`), eine je Projekt (`ProjectMember`).
//
// **Jeder Kontext löst genau eine dieser Rollen auf.** Es wird nichts vereinigt:
//
//     Plattform-Kontext:  Plattform-Rolle
//     Workspace-Kontext:  Workspace-Rolle
//     Projekt-Kontext:    Projektrolle
//
// Im Projekt gelten also nur Projektrechte, im Workspace nur Workspace-Rechte.
// Was die Ebene darüber erlaubt, spielt für die Ebene darunter keine Rolle —
// keine Zeile in `ProjectMember` heißt keine Projektrechte, auch für einen
// Workspace-Owner. Ein Verbot gibt es nicht und braucht es nicht: eine Rolle
// listet, was sie erlaubt, und „nicht aufgeführt" ist bereits das Verbot.
//
// Zwei Sicherungen halten das durch, auch wenn die Datenbank etwas anderes
// erzählt: `collect()` nimmt aus einer Rolle nur die Keys, die sie laut Registry
// tragen darf, und `permissionsFor(scope)` begrenzt jedes Ergebnis. Eine alte
// oder von Hand gesetzte `RolePermission`-Zeile im falschen Scope ist damit
// wirkungslos statt gefährlich.
//
// ── Die Generalschlüssel ──
//
// Strikte Trennung allein würde die Leitung eines Workspace aus ihren eigenen
// Projekten aussperren. Dafür gibt es drei Keys, und nur sie durchbrechen die
// Trennung — nach unten, nie nach oben:
//
//     tenant.access      (PLATFORM)   alles in jedem Workspace und Projekt
//     project.admin.all  (WORKSPACE)  alles in jedem Projekt des Workspace
//     project.view.all   (WORKSPACE)  lesend in jedes Projekt des Workspace
//
// Sie werden geprüft, **bevor** die Rolle der unteren Ebene überhaupt geladen
// wird. Genau darin liegt die Zusage: ein `blocked`-Eintrag auf einem Workspace-
// Admin ist keine Herabstufung, sondern eine wirkungslose Zeile. Es gibt keinen
// Datenzustand, der daran etwas ändert.
//
// Ein Permission-Key nennt nur Objekt und Aktion. Dass `label.create` in einer
// Workspace-Rolle den workspaceweiten Label meint und in einer Projektrolle den
// des Projekts, ergibt sich allein daraus, an welcher Rolle er hängt.

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

// `satisfies` statt nur `as const`: eine Auswahl, die in einer Variablen steht,
// prüft TypeScript beim Einsetzen nicht mehr auf überflüssige Felder — nur
// direkt geschriebene Objektliterale bekommen diese Prüfung. Ohne die Zusicherung
// hier überlebt ein Feld, das es im Schema nicht mehr gibt, jeden Typecheck und
// fällt erst zur Laufzeit auf.
const roleSelect = {
  key: true,
  rank: true,
  permissions: { select: { permissionKey: true } },
} as const satisfies Prisma.RoleSelect;

type GrantRow = { permissionKey: string };
type RoleWithGrants = { key: string; rank: number; permissions: GrantRow[] };

/**
 * Plattform-Rolle und Zustand des Kontos in einer Abfrage.
 *
 * Beides zusammen, weil beides auf jedem Pfad gebraucht wird und aus derselben
 * Zeile kommt: die Rolle für die Rechte, `deactivated` als Schranke davor. Ein
 * stillgelegtes Konto bekommt gar nichts — nicht auf der Plattform, in keinem
 * Workspace, in keinem Projekt. Die Sperre steht deshalb vor jeder
 * Rollenauflösung und nicht neben ihr.
 */
const loadPlatformState = cache(
  async (
    userId: string,
  ): Promise<{ role: RoleWithGrants | null; deactivated: boolean }> => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { deactivatedAt: true, platformRole: { select: roleSelect } },
    });
    return {
      role: user?.platformRole ?? null,
      deactivated: user?.deactivatedAt != null,
    };
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

/**
 * Die Rechte einer Rolle, sofern sie in diesem Scope überhaupt gelten können.
 *
 * Der Scope-Filter ist die eigentliche Trennung der Ebenen: was eine Rolle
 * dieses Scopes laut Registry nicht tragen darf, wird übergangen. Eine Zeile in
 * `RolePermission`, die aus einer früheren Fassung stammt oder von Hand gesetzt
 * wurde, wird dadurch wirkungslos — sie muss nicht erst aufgeräumt werden, damit
 * die Trennung stimmt.
 */
function collect(
  role: RoleWithGrants | null | undefined,
  scope: RoleScope,
): Set<Permission> {
  const granted = new Set<Permission>();
  if (!role) return granted;
  for (const grant of role.permissions) {
    const permission = toPermission(grant.permissionKey);
    if (!permission) continue;
    if (!isPermissionAllowedIn(permission, scope)) continue;
    granted.add(permission);
  }
  return granted;
}

function grants(role: RoleWithGrants | null, permission: Permission): boolean {
  return role?.permissions.some((g) => g.permissionKey === permission) ?? false;
}

// ─── Auflösung ────────────────────────────────────────────────────────────────

const EMPTY: Access = makeAccess(new Set(), {}, null, null);

/** Was die Workspace-Ebene hergibt — die Unterlage beider Mandanten-Kontexte. */
interface Base {
  /** Nur WORKSPACE-Keys, nur aus der Workspace-Rolle. */
  granted: Set<Permission>;
  roles: Partial<Record<RoleScope, ScopeRole>>;
  /** `tenant.access`: Support-Generalschlüssel, hebt alle Regeln auf. */
  master: boolean;
  /** Workspace gesperrt oder Einladung offen — aus dem Mandanten kommt nichts. */
  closed: boolean;
}

/**
 * Die Workspace-Ebene einsammeln.
 *
 * Beide Mandanten-Kontexte brauchen das: der Workspace-Kontext als Ergebnis, der
 * Projekt-Kontext für die Generalschlüssel und die Sperrgründe. Die
 * Plattform-Rolle wird dabei **nicht** eingesammelt — sie wirkt im Mandanten nur
 * über `tenant.access`. Ihr Key und Rang stehen trotzdem im Ergebnis, damit die
 * Oberfläche sie anzeigen kann.
 */
async function loadBase(userId: string, workspaceId: string): Promise<Base> {
  let granted = new Set<Permission>();
  const roles: Partial<Record<RoleScope, ScopeRole>> = {};

  // ── Support-Zugriff ─────────────────────────────────────────────────────────
  //
  // `tenant.access` ist der Generalschlüssel in fremde Workspaces. Er kann nur
  // in einer Plattform-Rolle stehen — Mandanten-Permissions sind laut Registry
  // in diesem Scope nicht vergebbar, es gibt also keinen feineren Weg. Wer ihn
  // hat, bekommt im Mandanten alles und ist von den Regeln unten ausgenommen:
  // gerade wenn ein Workspace gesperrt oder ein Projekt privat ist, muss der
  // Support hineinsehen können. `platform_admin` hat ihn bewusst NICHT.
  const platform = await loadPlatformState(userId);

  // Stillgelegt: nichts, und zwar vor allem anderen. Auch der Generalschlüssel
  // unten kommt für ein solches Konto nicht mehr zum Zug.
  if (platform.deactivated)
    return { granted, roles, master: false, closed: true };

  const platformRole = platform.role;
  if (platformRole) {
    roles.PLATFORM = { key: platformRole.key, rank: platformRole.rank };
  }
  if (grants(platformRole, "tenant.access"))
    return { granted, roles, master: true, closed: false };

  // ── Gesperrt, oder noch nicht angenommen ────────────────────────────────────
  //
  // Die Prüfung steht VOR dem Einsammeln der Workspace-Rolle. Wer hier gar
  // nichts einsammelt, kann auch nichts Falsches behalten.
  const [workspace, membership] = await Promise.all([
    loadWorkspaceMeta(workspaceId),
    loadWorkspaceRole(workspaceId, userId),
  ]);

  if (!workspace || workspace.suspended || membership?.pending)
    return { granted, roles, master: false, closed: true };

  // ── Scope WORKSPACE ─────────────────────────────────────────────────────────
  if (membership) {
    roles.WORKSPACE = { key: membership.role.key, rank: membership.role.rank };
    granted = collect(membership.role, "WORKSPACE");
  }

  return { granted, roles, master: false, closed: false };
}

/** Trägt die Workspace-Rolle diesen Generalschlüssel? */
function opens(
  base: Base,
  key: "project.admin.all" | "project.view.all",
): boolean {
  return base.granted.has(key);
}

async function resolve(
  userId: string | null,
  ctx: PermissionContext,
): Promise<Access> {
  if (!userId) return EMPTY;

  // ── Kontext PLATFORM ────────────────────────────────────────────────────────
  if ("scope" in ctx) {
    const platform = await loadPlatformState(userId);
    if (platform.deactivated) return EMPTY;

    const roles: Partial<Record<RoleScope, ScopeRole>> = {};
    if (platform.role) {
      roles.PLATFORM = { key: platform.role.key, rank: platform.role.rank };
    }
    return makeAccess(collect(platform.role, "PLATFORM"), roles, null, null);
  }

  // ── Kontext WORKSPACE ───────────────────────────────────────────────────────
  if (!("projectId" in ctx)) {
    const base = await loadBase(userId, ctx.workspaceId);
    const granted = base.master
      ? new Set<Permission>(permissionsFor("WORKSPACE"))
      : base.granted;
    return makeAccess(granted, base.roles, ctx.workspaceId, null);
  }

  // ── Kontext PROJECT ─────────────────────────────────────────────────────────
  //
  // Vier Regeln, in dieser Reihenfolge. Die ersten drei entscheiden ohne die
  // Projektrolle — deshalb kann keine Projektrolle sie aushebeln.
  const project = await loadProjectMeta(ctx.projectId);
  if (!project) return EMPTY;

  const base = await loadBase(userId, project.workspaceId);
  const where = [project.workspaceId, ctx.projectId] as const;

  // 1. Support sieht in jedes Projekt jedes Mandanten.
  if (base.master)
    return makeAccess(new Set(permissionsFor("PROJECT")), base.roles, ...where);

  // 2. Gesperrter Workspace oder offene Einladung: nichts.
  if (base.closed) return makeAccess(new Set(), base.roles, ...where);

  // 3. Der Generalschlüssel des Workspace. Die Projektrolle wird gar nicht erst
  //    geladen — und `roles.PROJECT` bleibt leer, damit `assignmentCeiling` nach
  //    oben offen ist. Sonst könnte ein Owner, den jemand auf `blocked` gesetzt
  //    hat, diese Herabstufung nicht mehr zurücknehmen.
  if (opens(base, "project.admin.all"))
    return makeAccess(new Set(permissionsFor("PROJECT")), base.roles, ...where);

  // 4. Sonst entscheidet allein die Projektrolle. Keine Zeile in
  //    `ProjectMember` heißt keine Projektrechte — auch bei einem öffentlichen
  //    Projekt und auch für ein Workspace-Mitglied.
  const projectRole = await loadProjectRole(ctx.projectId, userId);
  if (projectRole)
    base.roles.PROJECT = { key: projectRole.key, rank: projectRole.rank };

  const granted = collect(projectRole, "PROJECT");

  // Der schwächere Generalschlüssel: sehen ja, anfassen nein. Er steht nach der
  // Projektrolle, wirkt aber wie die anderen an ihr vorbei — ein `blocked`
  // verbirgt ein Projekt nicht vor dem, der laut Workspace-Rolle alle sehen darf.
  if (opens(base, "project.view.all")) granted.add("project.view");

  return makeAccess(granted, base.roles, ...where);
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
 * Navigationen bekämen sonst eine Auflösung je Projekt. Die Generalschlüssel
 * gelten für alle Projekte gleich und werden einmal aufgelöst; sonst entscheidet
 * die Projektrolle je Projekt — dieselben vier Regeln wie in `resolve`, nur über
 * alle Projekte auf einmal.
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

  // Regeln 1 und 3: Support und die Leitung des Workspace sehen jedes Projekt,
  // auch ohne Rolle darin.
  if (
    base.master ||
    opens(base, "project.admin.all") ||
    opens(base, "project.view.all")
  ) {
    for (const project of projects) visible.add(project.id);
    return visible;
  }
  // Regel 2.
  if (base.closed) return visible;

  const ownRole = new Map(memberships.map((m) => [m.projectId, m.role]));

  // Regel 4: keine Projektrolle heißt kein Zugriff — `ProjectMember` ist die
  // Liste, wer im Projekt ist.
  for (const project of projects) {
    const role = ownRole.get(project.id);
    if (!role) continue;
    if (collect(role, "PROJECT").has("project.view")) visible.add(project.id);
  }

  return visible;
});

/** Wie `accessibleProjectIds`, aber für den eingeloggten Benutzer. */
export async function visibleProjectIds(
  workspaceId: string,
): Promise<Set<string>> {
  return accessibleProjectIds(await currentUserId(), workspaceId);
}
