import "server-only";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform";

// DB-Abfragen für das Plattform-Admin-Panel. Jede Query verlangt selbst
// Plattform-Admin-Rechte — fail-safe, unabhängig vom aufrufenden Seitencode.

export interface AdminWorkspaceRow {
  id: string;
  name: string;
  slug: string;
  color: string;
  suspended: boolean;
  createdAt: Date;
  memberCount: number;
  projectCount: number;
}

/** Alle registrierten Workspaces (Tenants) mit Kennzahlen. Plattform-Admin only. */
export async function listWorkspacesForAdmin(): Promise<AdminWorkspaceRow[]> {
  await requirePlatformAdmin();

  const rows = await db.workspace.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      suspended: true,
      createdAt: true,
      _count: { select: { members: true, projects: true } },
    },
  });

  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    color: w.color,
    suspended: w.suspended,
    createdAt: w.createdAt,
    memberCount: w._count.members,
    projectCount: w._count.projects,
  }));
}

export interface AdminUserRow {
  id: string;
  name: string;
  handle: string;
  email: string;
}

/** Alle aktuellen Plattform-Admins. Plattform-Admin only. */
export async function listPlatformAdmins(): Promise<AdminUserRow[]> {
  await requirePlatformAdmin();

  return db.user.findMany({
    where: { isPlatformAdmin: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, handle: true, email: true },
  });
}

/** User, die noch keine Plattform-Admins sind (zum Befördern). Plattform-Admin only. */
export async function listGrantableUsers(): Promise<AdminUserRow[]> {
  await requirePlatformAdmin();

  return db.user.findMany({
    where: { isPlatformAdmin: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, handle: true, email: true },
  });
}
