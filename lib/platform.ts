import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { PermissionError } from "@/lib/permissions";
import { getSession } from "@/lib/session";

// ─── Plattform-Ebene ───────────────────────────────────────────────────────────
//
// Ein Plattform-Admin ist der SaaS-Betreiber: eine globale Rolle ÜBER allen
// Workspaces. Sie ist bewusst getrennt vom workspace-scoped RBAC (lib/permissions.ts)
// und gibt KEINEN Durchgriff auf Tenant-Inhalte (Issues, Kommentare). Sie erlaubt
// nur Plattform-Operationen: Workspaces auflisten, löschen, sperren und andere
// Plattform-Admins verwalten (siehe features/platform/actions.ts).

const lookupIsPlatformAdmin = cache(
  async (userId: string): Promise<boolean> => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    return user?.isPlatformAdmin ?? false;
  },
);

/** Ist dieser User ein Plattform-Admin? Wirft nicht. */
export async function isUserPlatformAdmin(userId: string): Promise<boolean> {
  return lookupIsPlatformAdmin(userId);
}

/** Ist der aktuell eingeloggte User ein Plattform-Admin? Wirft nicht. */
export async function currentUserIsPlatformAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return lookupIsPlatformAdmin(session.userId);
}

/**
 * Verlangt Plattform-Admin-Rechte. Wirft `PermissionError`, sonst gibt es die
 * User-Id zurück. Guard für alle Plattform-Operationen.
 */
export async function requirePlatformAdmin(): Promise<string> {
  const session = await getSession();
  if (!session) throw new PermissionError("platform.admin.required");
  if (!(await lookupIsPlatformAdmin(session.userId))) {
    throw new PermissionError("platform.admin.required");
  }
  return session.userId;
}
