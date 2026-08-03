import "server-only";
import { cache } from "react";
import { rolesInTarget, targetGuard } from "@/features/roles/scope";
import type {
  RoleManagerView,
  RoleTarget,
  RoleView,
} from "@/features/roles/types";
import { db } from "@/lib/db";
import { accessFor, assignmentCeiling, currentUserId } from "@/lib/permissions";
import {
  type PermissionEffect,
  permissionDesc,
  permissionsFor,
} from "@/lib/rbac";

/**
 * Alles, was ein Rollen-Editor braucht — die Rollen des Topfes, ihre Einträge,
 * die in diesem Scope möglichen Permissions und die Grenzen des Handelnden.
 *
 * Was jemand darf, entscheidet der Server: `manageable`, `grantable` und
 * `maxRank` kommen fertig heraus, damit die Oberfläche keine Rangregeln
 * nachbauen muss (und sie damit auch nicht falsch nachbauen kann).
 */
export const getRoleManagerView = cache(
  async (target: RoleTarget): Promise<RoleManagerView> => {
    const guard = targetGuard(target);
    const actorId = await currentUserId();
    const access = await accessFor(actorId, guard.ctx);
    const canManage = access.has(guard.permission);

    const rows = await db.role.findMany({
      where: rolesInTarget(target),
      orderBy: [{ system: "desc" }, { rank: "desc" }, { name: "asc" }],
      include: {
        permissions: { select: { permissionKey: true, effect: true } },
        _count: {
          select: {
            workspaceMembers: true,
            projectMembers: true,
            platformUsers: true,
          },
        },
      },
    });

    const maxRank = canManage
      ? assignmentCeiling(access, target.scope)
      : Number.NEGATIVE_INFINITY;

    const roles: RoleView[] = rows.map((r) => {
      const grants: Record<string, PermissionEffect> = {};
      for (const g of r.permissions) grants[g.permissionKey] = g.effect;

      return {
        id: r.id,
        key: r.key,
        name: r.name,
        desc: r.desc,
        rank: r.rank,
        system: r.system,
        local: r.projectId !== null,
        grants,
        // System-Rollen sind für alle Mandanten dieselbe Zeile und deshalb
        // gesperrt. Über den eigenen Rang greift ohnehin niemand hinaus.
        manageable: canManage && r.editable && r.rank <= maxRank,
        memberCount:
          r._count.workspaceMembers +
          r._count.projectMembers +
          r._count.platformUsers,
      };
    });

    const permissions = permissionsFor(target.scope).map((key) => ({
      key,
      desc: permissionDesc(key),
    }));

    return {
      target,
      roles,
      permissions,
      canManage,
      // Nur weitergeben, was man selbst hat. Sonst wäre jede Rollenverwaltung
      // ein Weg zur Selbstbeförderung.
      grantable: canManage
        ? permissionsFor(target.scope).filter((p) => access.has(p))
        : [],
      maxRank,
    };
  },
);
