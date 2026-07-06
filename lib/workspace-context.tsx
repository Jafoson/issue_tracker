"use client";

import { createContext, useContext } from "react";
import type {
  IssueType,
  Label,
  Priority,
  Project,
  Role,
  Status,
  User,
} from "@/types";

export interface SearchableIssue {
  id: string;
  key: number;
  title: string;
  status: string;
  project: string;
}

export interface WorkspaceData {
  workspace: { id: string; name: string; color: string };
  userWorkspaces: { id: string; name: string; color: string }[];
  me: User;
  members: User[];
  projects: Project[];
  labels: Label[];
  statuses: Status[];
  priorities: Priority[];
  issueTypes: IssueType[];
  roles: Role[];
  searchIssues: SearchableIssue[];
  // Globale Plattform-Rolle des aktuell eingeloggten Users ("admin" | "member";
  // steuert den Zugang zum /admin-Bereich). Bezieht sich nur auf `me`, nicht auf
  // `members`.
  globalRole: string;
}

const Ctx = createContext<WorkspaceData | null>(null);

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function WorkspaceProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: WorkspaceData;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
