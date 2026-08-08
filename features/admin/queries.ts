import { cache } from "react";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { PLATFORM, requirePermission } from "@/lib/permissions";

// Plattform-Ebene: workspace-übergreifende Abfragen für den /admin-Bereich.
// Nur in Server Components/Layouts verwenden (DB-Zugriff).
//
// Jede Abfrage prüft selbst. Das Layout in app/[locale]/(default)/admin tut das
// zwar auch, aber ein Layout ist keine Sicherheitsgrenze: es schützt nur die
// Seiten unter sich, nicht jeden Aufruf dieser Funktionen.

async function requirePlatformAccess(): Promise<void> {
  await requirePermission("platform.access", PLATFORM);
}

/** Die Plattform-Rolle eines Users, so weit die Oberfläche sie braucht. */
export interface PlatformRoleRef {
  key: string;
  name: string;
}

export interface CurrentUser {
  id: string;
  firstName: string;
  lastName: string;
  handle: string;
  email: string;
  color: string;
  platformRole: PlatformRoleRef | null;
}

export interface PlatformUser {
  id: string;
  firstName: string;
  lastName: string;
  handle: string;
  email: string;
  color: string;
  platformRole: PlatformRoleRef | null;
  workspaceCount: number;
}

const platformRoleSelect = {
  select: { key: true, name: true },
} as const satisfies Prisma.RoleDefaultArgs;

export interface PlatformStats {
  workspaces: number;
  users: number;
  projects: number;
}

export const getCurrentUser = cache(
  async (userId: string): Promise<CurrentUser | null> => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        handle: true,
        email: true,
        color: true,
        platformRole: platformRoleSelect,
      },
    });
    return user;
  },
);

export const getAllUsers = cache(async (): Promise<PlatformUser[]> => {
  await requirePlatformAccess();
  const rows = await db.user.findMany({
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      handle: true,
      email: true,
      color: true,
      platformRole: platformRoleSelect,
      _count: { select: { workspaces: true } },
    },
  });
  return rows.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    handle: u.handle,
    email: u.email,
    color: u.color,
    platformRole: u.platformRole,
    workspaceCount: u._count.workspaces,
  }));
});

export const getPlatformStats = cache(async (): Promise<PlatformStats> => {
  await requirePlatformAccess();
  const [workspaces, users, projects] = await Promise.all([
    db.workspace.count(),
    db.user.count(),
    db.project.count(),
  ]);
  return { workspaces, users, projects };
});

// Ziel für den „Zurück"-Button: der erste Workspace des Users (oder null).
export const getFirstWorkspaceId = cache(
  async (userId: string): Promise<string | null> => {
    const membership = await db.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
      orderBy: { workspace: { name: "asc" } },
    });
    return membership?.workspaceId ?? null;
  },
);
