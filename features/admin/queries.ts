import { cache } from "react";
import { db } from "@/lib/db";

// Plattform-Ebene: workspace-übergreifende Abfragen für den /admin-Bereich.
// Nur in Server Components/Layouts verwenden (DB-Zugriff).

export interface CurrentUser {
  id: string;
  name: string;
  handle: string;
  email: string;
  color: string;
  isPlatformAdmin: boolean;
}

export interface PlatformUser {
  id: string;
  name: string;
  handle: string;
  email: string;
  color: string;
  isPlatformAdmin: boolean;
  workspaceCount: number;
}

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
        name: true,
        handle: true,
        email: true,
        color: true,
        isPlatformAdmin: true,
      },
    });
    return user;
  },
);

export const getAllUsers = cache(async (): Promise<PlatformUser[]> => {
  const rows = await db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      handle: true,
      email: true,
      color: true,
      isPlatformAdmin: true,
      _count: { select: { workspaces: true } },
    },
  });
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    handle: u.handle,
    email: u.email,
    color: u.color,
    isPlatformAdmin: u.isPlatformAdmin,
    workspaceCount: u._count.workspaces,
  }));
});

export const getPlatformStats = cache(async (): Promise<PlatformStats> => {
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
