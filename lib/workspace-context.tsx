"use client";

import { createContext, useContext } from "react";
import type { User, Project, Label, Status, Priority, IssueType, Role } from "@/types";

export interface SearchableIssue {
  id: string;
  key: number;
  title: string;
  status: string;
  project: string;
}

export interface WorkspaceData {
  workspace: { id: string; name: string };
  me: User;
  members: User[];
  projects: Project[];
  labels: Label[];
  statuses: Status[];
  priorities: Priority[];
  issueTypes: IssueType[];
  roles: Role[];
  searchIssues: SearchableIssue[];
}

const Ctx = createContext<WorkspaceData | null>(null);

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function WorkspaceProvider({ children, value }: { children: React.ReactNode; value: WorkspaceData }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
