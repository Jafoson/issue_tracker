"use server";

import { revalidatePath } from "next/cache";
import {
  ownerColumns,
  rolesInTarget,
  targetGuard,
  targetOfRole,
  targetRoleId,
} from "@/features/roles/scope";
import type { GrantChange, RoleTarget } from "@/features/roles/types";
import { db } from "@/lib/db";
import {
  type Access,
  accessFor,
  assignmentCeiling,
  currentUserId,
} from "@/lib/permissions";
import {
  isPermissionAllowedIn,
  type Permission,
  type PermissionEffect,
  toPermission,
} from "@/lib/rbac";
import { slugify } from "@/lib/slug";

type RoleResult = { ok: true } | { error: string };

// Rollenverwaltung. Drei Regeln ziehen sich durch alle Aktionen:
//
//   1. System-Rollen sind unantastbar. Sie sind für alle Mandanten dieselbe
//      Zeile — eine Änderung träfe jeden. Wer eine Abwandlung braucht, legt
//      eine eigene Rolle an.
//   2. Niemand fasst eine Rolle über dem eigenen Rang an und legt keine an,
//      die darüber läge.
//   3. Niemand vergibt per ALLOW eine Permission, die er selbst nicht hat.
//      Sonst wäre jede Rollenverwaltung ein Weg zur Selbstbeförderung. DENY ist
//      davon ausgenommen: etwas zu verbieten erweitert niemandes Rechte.

async function revalidate() {
  revalidatePath("/", "layout");
}

interface Guard {
  actorId: string;
  access: Access;
  ceiling: number;
}

/** Prüft die Verwaltungsberechtigung des Topfes und ermittelt die Rangobergrenze. */
async function requireTargetManage(
  target: RoleTarget,
): Promise<Guard | { error: string }> {
  const actorId = await currentUserId();
  if (!actorId) return { error: "You must be logged in." };

  const { permission, ctx } = targetGuard(target);
  const access = await accessFor(actorId, ctx);
  if (!access.has(permission))
    return { error: "You are not allowed to manage roles here." };

  return { actorId, access, ceiling: assignmentCeiling(access, target.scope) };
}

/** Lädt eine Rolle mitsamt ihrem Topf und prüft die Berechtigung darauf. */
async function requireRoleManage(roleId: string): Promise<
  | {
      guard: Guard;
      target: RoleTarget;
      role: { id: string; rank: number };
    }
  | { error: string }
> {
  const role = await db.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      rank: true,
      editable: true,
      system: true,
      scope: true,
      workspaceId: true,
      projectId: true,
    },
  });
  if (!role) return { error: "This role no longer exists." };

  if (role.system) {
    return {
      error:
        "This is a shared default role and cannot be changed. Create your own role instead.",
    };
  }
  if (!role.editable)
    return { error: "This role is protected and cannot be changed." };

  const target = targetOfRole(role);
  if (!target) return { error: "This role no longer exists." };

  const guard = await requireTargetManage(target);
  if ("error" in guard) return guard;

  if (role.rank > guard.ceiling)
    return { error: "You cannot change a role ranked above your own." };

  return { guard, target, role };
}

// ─── Anlegen ──────────────────────────────────────────────────────────────────

export async function createRole(
  target: RoleTarget,
  data: { name: string; desc?: string; rank?: number },
): Promise<RoleResult> {
  const guard = await requireTargetManage(target);
  if ("error" in guard) return guard;

  const name = data.name.trim();
  if (!name) return { error: "Name is required." };

  const rank = Number.isFinite(data.rank) ? Number(data.rank) : 1;
  if (rank < 0) return { error: "Rank cannot be negative." };
  if (rank > guard.ceiling)
    return { error: "You cannot create a role above your own rank." };

  const key = await uniqueKey(target, slugify(name) || "role");
  const owner = ownerColumns(target);

  await db.role.create({
    data: {
      id: targetRoleId(target, key),
      scope: target.scope,
      workspaceId: owner.workspaceId,
      projectId: owner.projectId,
      key,
      name,
      desc: data.desc?.trim() ?? "",
      rank,
      editable: true,
      system: false,
    },
  });

  await revalidate();
  return { ok: true };
}

/** Hängt -2, -3, … an, bis der Key im Topf frei ist. */
async function uniqueKey(target: RoleTarget, base: string): Promise<string> {
  const where = rolesInTarget(target);
  let key = base;
  let n = 1;
  while (
    await db.role.findFirst({ where: { ...where, key }, select: { id: true } })
  ) {
    key = `${base}-${++n}`;
  }
  return key;
}

// ─── Ändern ───────────────────────────────────────────────────────────────────

export async function updateRole(
  roleId: string,
  data: { name?: string; desc?: string; rank?: number },
): Promise<RoleResult> {
  const found = await requireRoleManage(roleId);
  if ("error" in found) return found;

  const name = data.name?.trim();
  if (name !== undefined && !name) return { error: "Name is required." };

  if (data.rank !== undefined) {
    if (!Number.isFinite(data.rank) || data.rank < 0)
      return { error: "Rank must be zero or higher." };
    if (data.rank > found.guard.ceiling)
      return { error: "You cannot raise a role above your own rank." };
  }

  await db.role.update({
    where: { id: roleId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(data.desc !== undefined ? { desc: data.desc.trim() } : {}),
      ...(data.rank !== undefined ? { rank: data.rank } : {}),
    },
  });

  await revalidate();
  return { ok: true };
}

// ─── Löschen ──────────────────────────────────────────────────────────────────

export async function deleteRole(roleId: string): Promise<RoleResult> {
  const found = await requireRoleManage(roleId);
  if ("error" in found) return found;

  // Die Fremdschlüssel stehen auf RESTRICT — das hier ist die verständliche
  // Fehlermeldung davor, nicht der eigentliche Schutz.
  const inUse = await db.role.findUnique({
    where: { id: roleId },
    select: {
      _count: {
        select: {
          workspaceMembers: true,
          projectMembers: true,
          platformUsers: true,
        },
      },
    },
  });
  const carriers =
    (inUse?._count.workspaceMembers ?? 0) +
    (inUse?._count.projectMembers ?? 0) +
    (inUse?._count.platformUsers ?? 0);
  if (carriers > 0)
    return {
      error: "Someone still has this role. Move them to another one first.",
    };

  await db.role.delete({ where: { id: roleId } });

  await revalidate();
  return { ok: true };
}

// ─── Permissions setzen ───────────────────────────────────────────────────────

/**
 * Setzt einen Permission-Eintrag einer Rolle auf ALLOW, DENY oder zurück auf
 * „nicht gesetzt" (`effect: null`).
 */
export async function setRoleGrant(
  roleId: string,
  permissionKey: string,
  effect: PermissionEffect | null,
): Promise<RoleResult> {
  return setRoleGrants([{ roleId, permission: permissionKey, effect }]);
}

/**
 * Schreibt einen ganzen Stapel Einträge — was der Speichern-Knopf der Matrix
 * abschickt.
 *
 * Alles oder nichts: erst wird jede einzelne Änderung geprüft, geschrieben wird
 * danach in einer Transaktion. Ein halb übernommener Stapel wäre bei
 * Berechtigungen die schlechteste aller Antworten — die Oberfläche zeigte einen
 * Fehler, und trotzdem hätte sich die Hälfte der Rechte verschoben.
 */
export async function setRoleGrants(
  changes: GrantChange[],
): Promise<RoleResult> {
  if (changes.length === 0) return { ok: true };

  // Ein Stapel trifft ein paar Rollen und viele Zellen. Die Prüfung einer Rolle
  // lädt sie und wiegt ihren Rang gegen den des Handelnden — das fällt deshalb
  // je Rolle an, nicht je Änderung.
  const checked = new Map<
    string,
    Awaited<ReturnType<typeof requireRoleManage>>
  >();

  const writes: {
    roleId: string;
    permission: Permission;
    effect: PermissionEffect | null;
  }[] = [];

  for (const change of changes) {
    let found = checked.get(change.roleId);
    if (!found) {
      found = await requireRoleManage(change.roleId);
      checked.set(change.roleId, found);
    }
    if ("error" in found) return found;

    const permission = toPermission(change.permission);
    if (!permission) return { error: "Unknown permission." };

    // Nicht jede Permission ist in jedem Scope sinnvoll — `workspace.update`
    // gehört nicht in eine Projektrolle.
    if (!isPermissionAllowedIn(permission, found.target.scope))
      return { error: "That permission does not apply in this scope." };

    // Erlauben kann nur, wer es selbst darf. Verbieten darf jeder, der die Rolle
    // verwaltet — ein Verbot vergrößert niemandes Rechte.
    if (change.effect === "ALLOW" && !found.guard.access.has(permission))
      return { error: "You cannot grant a permission you do not have." };

    writes.push({
      roleId: change.roleId,
      permission,
      effect: change.effect,
    });
  }

  // Die Abfragen entstehen erst hier: oben stünde nach einem Fehler ein halbes
  // Dutzend fertiger Schreibvorgänge herum, die niemand mehr abschickt.
  await db.$transaction(
    writes.map(({ roleId, permission, effect }) =>
      effect === null
        ? db.rolePermission.deleteMany({
            where: { roleId, permissionKey: permission },
          })
        : db.rolePermission.upsert({
            where: {
              roleId_permissionKey: { roleId, permissionKey: permission },
            },
            update: { effect },
            create: { roleId, permissionKey: permission, effect },
          }),
    ),
  );

  await revalidate();
  return { ok: true };
}
