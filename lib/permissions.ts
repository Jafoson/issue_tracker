import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Permission } from "@/lib/rbac";
import { getSession } from "@/lib/session";

export type { Permission } from "@/lib/rbac";

/** Kontext einer Berechtigungsprüfung — genau eine Ebene angeben. */
export interface PermissionContext {
  workspaceId?: string;
  projectId?: string;
}

/** Wird geworfen, wenn eine Prüfung fehlschlägt. Actions schlagen damit fehl-sicher fehl. */
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

const getProjectMeta = cache(async (projectId: string) => {
  return db.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true, visibility: true },
  });
});

const getMembership = cache(async (workspaceId: string, userId: string) => {
  return db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true, pending: true },
  });
});

const getProjectMembership = cache(
  async (projectId: string, userId: string) => {
    return db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });
  },
);

const getRolePermissions = cache(
  async (workspaceId: string, roleKey: string) => {
    const role = await db.role.findUnique({
      where: { workspaceId_key: { workspaceId, key: roleKey } },
      select: { permissions: { select: { permissionKey: true } } },
    });
    return new Set(role?.permissions.map((p) => p.permissionKey) ?? []);
  },
);

// ─── Effektive Rolle bestimmen ────────────────────────────────────────────────
//
// Workspace-Rolle ist der Fallback. Eine projekt-spezifische Rolle überschreibt
// sie vollständig. Owner & Admin haben implizit Zugriff auf alle Projekte. Bei
// privaten Projekten reicht die Workspace-Rolle ohne ProjectMember-Eintrag nicht.

async function effectiveRole(
  userId: string,
  ctx: PermissionContext,
): Promise<{ workspaceId: string; roleKey: string } | null> {
  if (ctx.projectId) {
    const project = await getProjectMeta(ctx.projectId);
    if (!project) return null;
    const workspaceId = project.workspaceId;

    const wm = await getMembership(workspaceId, userId);
    const isWorkspaceMember = !!wm && !wm.pending;

    // Owner/Admin: impliziter Vollzugriff auf alle Projekte, unabhängig von ProjectMember.
    if (isWorkspaceMember && (wm.role === "owner" || wm.role === "admin")) {
      return { workspaceId, roleKey: wm.role };
    }

    // Projekt-spezifische Rolle überschreibt die Workspace-Rolle vollständig.
    const pm = await getProjectMembership(ctx.projectId, userId);
    if (pm) return { workspaceId, roleKey: pm.role };

    // Kein ProjectMember-Eintrag → Workspace-Rolle nur bei öffentlichen Projekten.
    if (project.visibility === "public" && isWorkspaceMember) {
      return { workspaceId, roleKey: wm.role };
    }
    return null;
  }

  if (ctx.workspaceId) {
    const wm = await getMembership(ctx.workspaceId, userId);
    if (!wm || wm.pending) return null;
    return { workspaceId: ctx.workspaceId, roleKey: wm.role };
  }

  return null;
}

// ─── Öffentliche API ───────────────────────────────────────────────────────────

/** Hat `userId` die Permission im gegebenen Kontext? Wirft nicht. */
export async function can(
  userId: string,
  permission: Permission,
  ctx: PermissionContext,
): Promise<boolean> {
  const eff = await effectiveRole(userId, ctx);
  if (!eff) return false;
  const perms = await getRolePermissions(eff.workspaceId, eff.roleKey);
  return perms.has(permission);
}

/** Hat der aktuell eingeloggte User die Permission? Wirft nicht (false ohne Session). */
export async function hasPermission(
  permission: Permission,
  ctx: PermissionContext,
): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;
  return can(userId, permission, ctx);
}

export interface PermissionCheck {
  permission: Permission;
  ctx: PermissionContext;
  /**
   * Für `.own`-Permissions: Liste der Owner-Ids (z. B. [reporterId, assigneeId]).
   * Der Check greift nur, wenn der aktuelle User in dieser Liste steht.
   */
  ownerIds?: (string | null | undefined)[];
}

/**
 * Erfüllt, wenn mindestens einer der Checks zutrifft (für `.own`/`.any`-Paare).
 * Wirft `PermissionError`, sonst gibt es die User-Id zurück.
 */
export async function requirePermissionOr(
  checks: PermissionCheck[],
): Promise<string> {
  const userId = await requireUserId();
  for (const check of checks) {
    if (check.ownerIds && !check.ownerIds.includes(userId)) continue;
    if (await can(userId, check.permission, check.ctx)) return userId;
  }
  throw new PermissionError(checks[0]?.permission ?? "unknown");
}

/** Verlangt eine einzelne Permission. Wirft `PermissionError`, sonst User-Id. */
export async function requirePermission(
  permission: Permission,
  ctx: PermissionContext,
): Promise<string> {
  return requirePermissionOr([{ permission, ctx }]);
}

/** Workspace-Rollen-Key des Users (für Hierarchie-Checks), oder null. */
export async function workspaceRoleKey(
  workspaceId: string,
  userId: string,
): Promise<string | null> {
  const wm = await getMembership(workspaceId, userId);
  if (!wm || wm.pending) return null;
  return wm.role;
}
