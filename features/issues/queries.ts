import { cache } from "react";
import { db } from "@/lib/db";
import { toDoc } from "@/lib/richtext/doc";
import type {
  Issue,
  IssueType,
  Label,
  Priority,
  Project,
  Role,
  SearchableIssue,
  Status,
  Team,
  User,
} from "@/types";

// ── Shared DB → client mappers ────────────────────────────────────────────────

function mapIssue(i: {
  id: string;
  key: number;
  title: string;
  status: string;
  priority: number;
  // `JsonValue` aus der Datenbank: was in der Spalte steht, ist erst einmal
  // beliebiges JSON. `toDoc` macht daraus ein gültiges Dokument — oder ein
  // leeres, falls die Zeile beschädigt ist.
  description: unknown;
  type: string;
  labels: string[];
  rank: number;
  assigneeId: string | null;
  reporterId: string;
  projectId: string;
  created: Date;
  updated: Date;
  comments: { id: string; body: unknown; authorId: string; created: Date }[];
}): Issue {
  return {
    id: i.id,
    key: i.key,
    title: i.title,
    status: i.status,
    priority: i.priority,
    description: toDoc(i.description),
    type: i.type,
    labels: i.labels,
    rank: i.rank,
    assignee: i.assigneeId,
    reporter: i.reporterId,
    project: i.projectId,
    created: i.created.getTime(),
    updated: i.updated.getTime(),
    comments: i.comments.map((c) => ({
      id: c.id,
      body: toDoc(c.body),
      author: c.authorId,
      time: c.created.getTime(),
    })),
  };
}

// ── Cached queries (deduplicated per request) ─────────────────────────────────

export const getWorkspace = cache(async (id: string) => {
  // Gesperrte Workspaces (vom Plattform-Admin suspendiert) sind für den normalen
  // App-Zugriff nicht auffindbar → die Layouts behandeln sie via notFound().
  return db.workspace.findFirst({
    where: { id, suspended: false },
    select: { id: true, name: true, color: true },
  });
});

export const getUserWorkspaces = cache(async (userId: string) => {
  const rows = await db.workspaceMember.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, name: true, color: true } } },
    orderBy: { workspace: { name: "asc" } },
  });
  return rows.map((r) => r.workspace);
});

export const getProjects = cache(
  async (workspaceId: string): Promise<Project[]> => {
    const rows = await db.project.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      prefix: p.prefix,
      color: p.color,
    }));
  },
);

export const getMembers = cache(
  async (workspaceId: string): Promise<User[]> => {
    const rows = await db.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true, role: { select: { key: true, rank: true } } },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    });
    return rows.map((m) => {
      return {
        id: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        handle: m.user.handle,
        email: m.user.email,
        color: m.user.color,
        role: m.role.key,
        roleRank: m.role.rank,
        pending: m.pending,
      };
    });
  },
);

export const getLabels = cache(
  async (workspaceId: string): Promise<Label[]> => {
    const rows = await db.label.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    });
    return rows.map((l) => ({
      id: l.id,
      name: l.name,
      slug: l.slug,
      color: l.color,
      projectId: l.projectId ?? null,
    }));
  },
);

export const getStatuses = cache(
  async (workspaceId: string): Promise<Status[]> => {
    const rows = await db.status.findMany({
      where: { workspaces: { some: { workspaceId } } },
      orderBy: { position: "asc" },
    });
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      short: s.short,
      color: s.color,
      isColumn: s.isColumn,
    }));
  },
);

export const getPriorities = cache(
  async (workspaceId: string): Promise<Priority[]> => {
    const rows = await db.priority.findMany({
      where: { workspaces: { some: { workspaceId } } },
      orderBy: { position: "asc" },
    });
    return rows.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      color: p.color,
    }));
  },
);

export const getIssueTypes = cache(
  async (workspaceId: string): Promise<IssueType[]> => {
    const rows = await db.issueType.findMany({
      where: { workspaces: { some: { workspaceId } } },
      orderBy: { position: "asc" },
    });
    return rows.map((t) => ({ id: t.id, name: t.name, color: t.color }));
  },
);

/**
 * Die im Workspace zuweisbaren Rollen: die geteilten System-Rollen des Scopes
 * WORKSPACE plus die selbst angelegten dieses Workspace. Für die Projektrollen
 * siehe `getProjectMembersView`.
 */
export const getRoles = cache(async (workspaceId: string): Promise<Role[]> => {
  const rows = await db.role.findMany({
    where: { scope: "WORKSPACE", OR: [{ system: true }, { workspaceId }] },
    orderBy: { rank: "desc" },
  });
  // `id` ist der stabile Role-Key, den die UI als Wert nutzt.
  return rows.map((r) => ({
    id: r.key,
    name: r.name,
    desc: r.desc,
    rank: r.rank,
  }));
});

export const getTeams = cache(async (workspaceId: string): Promise<Team[]> => {
  const rows = await db.team.findMany({
    where: { workspaceId },
    include: {
      members: { select: { userId: true } },
      projects: { select: { projectId: true } },
    },
    orderBy: { name: "asc" },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    key: t.key,
    color: t.color,
    desc: t.desc,
    lead: t.leadId,
    members: t.members.map((m) => m.userId),
    projects: t.projects.map((p) => p.projectId),
  }));
});

export async function getIssuesByProject(
  projectId: string,
  filters: {
    status?: string;
    priority?: string;
    assignee?: string;
    label?: string;
    q?: string;
  } = {},
): Promise<Issue[]> {
  // URL filter values are human-readable slugs — resolve them to the internal
  // values stored on the issue (status slug == status id, so it needs no lookup).
  const statuses = filters.status?.split(",").filter(Boolean) ?? [];
  const prioritySlugs = filters.priority?.split(",").filter(Boolean) ?? [];
  const assigneeSlugs = filters.assignee?.split(",").filter(Boolean) ?? [];
  const labelSlugs = filters.label?.split(",").filter(Boolean) ?? [];

  const [priorityRows, assigneeRows, labelRows] = await Promise.all([
    prioritySlugs.length
      ? db.priority.findMany({
          where: { key: { in: prioritySlugs } },
          select: { id: true },
        })
      : Promise.resolve([]),
    assigneeSlugs.length
      ? db.user.findMany({
          where: { handle: { in: assigneeSlugs } },
          select: { id: true },
        })
      : Promise.resolve([]),
    labelSlugs.length
      ? db.label.findMany({
          where: {
            slug: { in: labelSlugs },
            workspace: { projects: { some: { id: projectId } } },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const priorities = priorityRows.map((p) => p.id);
  const assignees = assigneeRows.map((u) => u.id);
  const labels = labelRows.map((l) => l.id);

  // Die Suche filtert "nach Titel oder ID": `ORB-12` bzw. `12` trifft zusätzlich
  // die Issue-Nummer. Die Ziffernlänge ist begrenzt, damit nichts den Int-Bereich
  // der Spalte sprengt.
  const q = filters.q?.trim();
  const keyDigits = q?.match(/^(?:[a-z]+-)?(\d{1,9})$/i)?.[1];
  const key = keyDigits ? Number(keyDigits) : undefined;

  const rows = await db.issue.findMany({
    where: {
      projectId,
      ...(statuses.length && { status: { in: statuses } }),
      ...(priorities.length && { priority: { in: priorities } }),
      ...(assignees.length && { assigneeId: { in: assignees } }),
      ...(labels.length && { labels: { hasSome: labels } }),
      ...(q && {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { descriptionText: { contains: q, mode: "insensitive" as const } },
          ...(key !== undefined ? [{ key }] : []),
        ],
      }),
    },
    include: { comments: { orderBy: { created: "asc" } } },
    orderBy: [{ rank: "asc" }, { created: "asc" }],
  });
  return rows.map(mapIssue);
}

export async function getMyIssues(
  userId: string,
  workspaceId: string,
): Promise<Issue[]> {
  const rows = await db.issue.findMany({
    where: { assigneeId: userId, project: { workspaceId } },
    include: { comments: { orderBy: { created: "asc" } } },
    orderBy: { updated: "desc" },
  });
  return rows.map(mapIssue);
}

export async function getInboxIssues(
  userId: string,
  workspaceId: string,
): Promise<Issue[]> {
  const rows = await db.issue.findMany({
    where: {
      project: { workspaceId },
      OR: [{ assigneeId: userId }, { reporterId: userId }],
      comments: { some: { authorId: { not: userId } } },
    },
    include: {
      comments: {
        where: { authorId: { not: userId } },
        orderBy: { created: "desc" },
      },
    },
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

/**
 * Löst eine Referenz der Form „PREFIX-123“ innerhalb eines Workspace auf.
 *
 * Über `cache()`, weil die Detailseite sie zweimal im selben Request braucht:
 * einmal für `generateMetadata` (Tab-Titel) und einmal für die Seite selbst.
 */
export const getIssueByRef = cache(
  async (workspaceId: string, issueRef: string): Promise<Issue | null> => {
    const match = issueRef.match(/^([A-Z0-9]+)-(\d+)$/i);
    if (!match) return null;
    const prefix = match[1].toUpperCase();
    const key = parseInt(match[2], 10);

    const project = await db.project.findFirst({
      where: { workspaceId, prefix },
    });
    if (!project) return null;

    const i = await db.issue.findUnique({
      where: { projectId_key: { projectId: project.id, key } },
      include: { comments: { orderBy: { created: "asc" } } },
    });
    return i ? mapIssue(i) : null;
  },
);

export const getSearchIssues = cache(
  async (workspaceId: string): Promise<SearchableIssue[]> => {
    const rows = await db.issue.findMany({
      where: { project: { workspaceId } },
      select: {
        id: true,
        key: true,
        title: true,
        status: true,
        projectId: true,
      },
      orderBy: { updated: "desc" },
      take: 500,
    });
    return rows.map((i) => ({
      id: i.id,
      key: i.key,
      title: i.title,
      status: i.status,
      project: i.projectId,
    }));
  },
);
