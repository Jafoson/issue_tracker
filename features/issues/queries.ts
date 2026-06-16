import { cache } from "react";
import { db } from "@/lib/db";
import type { Issue, User, Project, Team, Label, Status, Priority, IssueType, Role } from "@/types";
import type { SearchableIssue } from "@/lib/workspace-context";

// ── Shared DB → client mappers ────────────────────────────────────────────────

function mapIssue(i: {
  id: string; key: number; title: string; status: string; priority: number;
  description: string; type: string; labels: string[]; rank: number;
  assigneeId: string | null; reporterId: string; projectId: string;
  created: Date; updated: Date;
  comments: { id: string; body: string; authorId: string; created: Date }[];
}): Issue {
  return {
    id: i.id, key: i.key, title: i.title, status: i.status, priority: i.priority,
    description: i.description, type: i.type, labels: i.labels, rank: i.rank,
    assignee: i.assigneeId, reporter: i.reporterId, project: i.projectId,
    created: i.created.getTime(), updated: i.updated.getTime(),
    comments: i.comments.map((c) => ({
      id: c.id, body: c.body, author: c.authorId, time: c.created.getTime(),
    })),
  };
}

// ── Cached queries (deduplicated per request) ─────────────────────────────────

export const getWorkspace = cache(async (id: string) => {
  return db.workspace.findUnique({ where: { id }, select: { id: true, name: true, color: true } });
});

export const getUserWorkspaces = cache(async (userId: string) => {
  const rows = await db.workspaceMember.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, name: true, color: true } } },
    orderBy: { workspace: { name: "asc" } },
  });
  return rows.map((r) => r.workspace);
});

export const getProjects = cache(async (workspaceId: string): Promise<Project[]> => {
  const rows = await db.project.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
  return rows.map((p) => ({ id: p.id, name: p.name, prefix: p.prefix, color: p.color }));
});

export const getMembers = cache(async (workspaceId: string): Promise<User[]> => {
  const rows = await db.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((m) => ({
    id: m.user.id, name: m.user.name, handle: m.user.handle,
    email: m.user.email, color: m.user.color,
    role: m.role as User["role"], pending: m.pending,
  }));
});

export const getLabels = cache(async (workspaceId: string): Promise<Label[]> => {
  const rows = await db.label.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
  return rows.map((l) => ({ id: l.id, name: l.name, color: l.color }));
});

export const getStatuses = cache(async (workspaceId: string): Promise<Status[]> => {
  const rows = await db.status.findMany({
    where: { workspaces: { some: { workspaceId } } },
    orderBy: { position: "asc" },
  });
  return rows.map((s) => ({ id: s.id, name: s.name, short: s.short, color: s.color, isColumn: s.isColumn }));
});

export const getPriorities = cache(async (workspaceId: string): Promise<Priority[]> => {
  const rows = await db.priority.findMany({
    where: { workspaces: { some: { workspaceId } } },
    orderBy: { position: "asc" },
  });
  return rows.map((p) => ({ id: p.id, key: p.key, name: p.name, color: p.color }));
});

export const getIssueTypes = cache(async (workspaceId: string): Promise<IssueType[]> => {
  const rows = await db.issueType.findMany({
    where: { workspaces: { some: { workspaceId } } },
    orderBy: { position: "asc" },
  });
  return rows.map((t) => ({ id: t.id, name: t.name, color: t.color }));
});

export const getRoles = cache(async (workspaceId: string): Promise<Role[]> => {
  const rows = await db.role.findMany({
    where: { workspaces: { some: { workspaceId } } },
    orderBy: { id: "asc" },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, desc: r.desc }));
});

export const getTeams = cache(async (workspaceId: string): Promise<Team[]> => {
  const rows = await db.team.findMany({
    where: { workspaceId },
    include: {
      members:  { select: { userId:    true } },
      projects: { select: { projectId: true } },
    },
    orderBy: { name: "asc" },
  });
  return rows.map((t) => ({
    id: t.id, name: t.name, key: t.key, color: t.color, desc: t.desc,
    lead:     t.leadId,
    members:  t.members.map((m) => m.userId),
    projects: t.projects.map((p) => p.projectId),
  }));
});

export async function getIssuesByProject(
  projectId: string,
  filters: {
    status?: string; priority?: string; assignee?: string;
    label?: string; q?: string;
  } = {},
): Promise<Issue[]> {
  const statuses   = filters.status?.split(",").filter(Boolean)              ?? [];
  const priorities = filters.priority?.split(",").map(Number).filter((n) => !isNaN(n)) ?? [];
  const assignees  = filters.assignee?.split(",").filter(Boolean)            ?? [];
  const labels     = filters.label?.split(",").filter(Boolean)               ?? [];

  const rows = await db.issue.findMany({
    where: {
      projectId,
      ...(statuses.length   && { status:     { in: statuses } }),
      ...(priorities.length && { priority:   { in: priorities } }),
      ...(assignees.length  && { assigneeId: { in: assignees } }),
      ...(labels.length     && { labels:     { hasSome: labels } }),
      ...(filters.q && {
        OR: [
          { title:       { contains: filters.q, mode: "insensitive" } },
          { description: { contains: filters.q, mode: "insensitive" } },
        ],
      }),
    },
    include: { comments: { orderBy: { created: "asc" } } },
    orderBy: [{ rank: "asc" }, { created: "asc" }],
  });
  return rows.map(mapIssue);
}

export async function getMyIssues(userId: string, workspaceId: string): Promise<Issue[]> {
  const rows = await db.issue.findMany({
    where: { assigneeId: userId, project: { workspaceId } },
    include: { comments: { orderBy: { created: "asc" } } },
    orderBy: { updated: "desc" },
  });
  return rows.map(mapIssue);
}

export async function getInboxIssues(userId: string, workspaceId: string): Promise<Issue[]> {
  const rows = await db.issue.findMany({
    where: {
      project: { workspaceId },
      OR: [{ assigneeId: userId }, { reporterId: userId }],
      comments: { some: { authorId: { not: userId } } },
    },
    include: { comments: { where: { authorId: { not: userId } }, orderBy: { created: "desc" } } },
    orderBy: { updated: "desc" },
    take: 30,
  });
  return rows.map(mapIssue);
}

export async function getIssueById(id: string): Promise<Issue | null> {
  const i = await db.issue.findUnique({
    where: { id },
    include: { comments: { orderBy: { created: "asc" } } },
  });
  return i ? mapIssue(i) : null;
}

export const getSearchIssues = cache(async (workspaceId: string): Promise<SearchableIssue[]> => {
  const rows = await db.issue.findMany({
    where: { project: { workspaceId } },
    select: { id: true, key: true, title: true, status: true, projectId: true },
    orderBy: { updated: "desc" },
    take: 500,
  });
  return rows.map((i) => ({ id: i.id, key: i.key, title: i.title, status: i.status, project: i.projectId }));
});
