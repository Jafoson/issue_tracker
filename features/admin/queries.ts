import { cache } from "react";
import type { ActivityPage } from "@/features/audit/actions";
import { ACTIVITY_PAGE_SIZE } from "@/features/audit/constants";
import { type AuditAction, listAudit } from "@/lib/audit";
import {
  type BucketUnit,
  bucketKey,
  previousWindow,
  type RangeKey,
  windowFor,
} from "@/lib/buckets";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { TABLE_PAGE_SIZE } from "@/lib/pagination";
import { PLATFORM, requirePermission } from "@/lib/permissions";
import { OWNER_ROLE_KEY } from "@/lib/rbac";
import { resolveAvatarUrl } from "@/lib/storage";

// ─── Platform level: the shell of the system ──────────────────────────────────
//
// Cross-workspace queries for `/admin`. Use only in server components and
// layouts (DB access).
//
// **This file's boundary is also a substantive commitment.** Platform
// administration sees the system, not what's being worked on inside it:
// accounts, roles, workspaces, project metadata, the audit log. No issue, no
// comment, no attachment, no description text — not filtered out, but never
// loaded in the first place. Whoever adds a query here that reads `issue`,
// `comment`, or a text column from either one breaks this commitment.
//
// Anyone who needs to look inside a project takes one of the two paths meant
// for that — and both are visible: `tenant.access` (support role) or the
// break-glass access from `features/admin/actions.ts`, which requires a
// reason and ends up in the audit log.
//
// The same applies to the dashboard further down: it counts issues and
// comments, it doesn't read any. A number over time says how much work
// happened — not a word about what it was.
//
// Every query checks for itself. The layout in `app/[locale]/(default)/admin`
// also does this, but a layout is not a security boundary: it only protects
// the pages beneath it, not every call to these functions.

async function requirePlatformAccess(): Promise<void> {
  await requirePermission("platform.access", PLATFORM);
}

/** A user's platform role, to the extent the UI needs it. */
export interface PlatformRoleRef {
  key: string;
  name: string;
}

export interface CurrentUser {
  id: string;
  firstName: string;
  lastName: string;
  handle: string;
  email: string | null;
  color: string;
  image?: string;
  platformRole: PlatformRoleRef | null;
}

/**
 * An account, as the user management screen shows it.
 */
export interface PlatformUser {
  id: string;
  firstName: string;
  lastName: string;
  handle: string;
  email: string | null;
  color: string;
  image?: string;
  platformRole: PlatformRoleRef | null;
  workspaceCount: number;
  createdAt: Date;
  lastSeenAt: Date | null;
  /** Set means deactivated: no access, no permissions. */
  deactivatedAt: Date | null;
  /** Whether a passkey is registered. Otherwise: connected provider or
   *  invitation not yet accepted. */
  hasPasskey: boolean;
  /** Account exists, but the invitation hasn't been accepted anywhere yet. */
  invitePending: boolean;
}

const platformRoleSelect = {
  select: { key: true, name: true },
} as const satisfies Prisma.RoleDefaultArgs;

export interface PlatformStats {
  workspaces: number;
  users: number;
  projects: number;
  /** Accounts that are deactivated — they're still counted in `users`. */
  deactivatedUsers: number;
  /** Projects with no owner: deleted account, nobody responsible. */
  orphanedProjects: number;
  /** Break-glass accesses in the last 30 days. Should be small and stay that way. */
  recentBreakGlass: number;
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
        image: true,
        avatarKey: true,
        platformRole: platformRoleSelect,
      },
    });
    if (!user) return null;

    const { image, avatarKey, ...rest } = user;
    return {
      ...rest,
      image: (await resolveAvatarUrl(avatarKey)) ?? image ?? undefined,
    };
  },
);

/**
 * All accounts, paginated. `limit` unset means unlimited — that's how the
 * owner assignment in `AdminProjectsPage` calls it, since it needs every
 * account to choose from, not just the first page. The user management
 * screen itself (`AdminUsersPage`) sets `limit` explicitly for infinite scroll.
 */
export const getAllUsers = cache(
  async (
    cursor?: string,
    limit?: number,
  ): Promise<{ rows: PlatformUser[]; nextCursor: string | null }> => {
    await requirePermission("user.manage", PLATFORM);
    const rows = await db.user.findMany({
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      ...(limit ? { take: limit } : {}),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        handle: true,
        email: true,
        color: true,
        image: true,
        avatarKey: true,
        createdAt: true,
        lastSeenAt: true,
        deactivatedAt: true,
        platformRole: platformRoleSelect,
        _count: { select: { workspaces: true, authenticators: true } },
        workspaces: { select: { pending: true } },
      },
    });

    return {
      rows: await Promise.all(
        rows.map(async (u) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          handle: u.handle,
          email: u.email,
          color: u.color,
          image: (await resolveAvatarUrl(u.avatarKey)) ?? u.image ?? undefined,
          platformRole: u.platformRole,
          workspaceCount: u._count.workspaces,
          createdAt: u.createdAt,
          lastSeenAt: u.lastSeenAt,
          deactivatedAt: u.deactivatedAt,
          hasPasskey: u._count.authenticators > 0,
          invitePending:
            u.workspaces.length > 0 && u.workspaces.every((m) => m.pending),
        })),
      ),
      nextCursor:
        limit && rows.length === limit ? rows[rows.length - 1].id : null,
    };
  },
);

/** An assignable platform role. */
export interface PlatformRoleOption {
  id: string;
  key: string;
  name: string;
  rank: number;
}

/**
 * The roles that exist at the platform level — for the selection in user
 * management. Which of them someone can actually assign is decided by
 * `setPlatformRole` based on rank; the list itself is not a permission.
 */
export const getPlatformRoles = cache(
  async (): Promise<PlatformRoleOption[]> => {
    await requirePermission("user.manage", PLATFORM);
    return db.role.findMany({
      where: { scope: "PLATFORM" },
      orderBy: { rank: "desc" },
      select: { id: true, key: true, name: true, rank: true },
    });
  },
);

/**
 * A project, as platform administration sees it: its shell.
 *
 * Name, location, owner, age, state, size — enough to find orphaned projects,
 * attribute costs, and clean up. The numbers are counts, not content:
 * `issueCount` says how much is in there, not what.
 */
export interface PlatformProject {
  id: string;
  name: string;
  slug: string;
  color: string;
  avatarUrl: string | null;
  visibility: "public" | "private";
  createdAt: Date;
  archivedAt: Date | null;
  workspace: { id: string; name: string; color: string; suspended: boolean };
  /** Who created it — null if the account was deleted. */
  owner: { id: string; firstName: string; lastName: string } | null;
  memberCount: number;
  issueCount: number;
  /**
   * No owner, or not a single member — nobody is responsible anymore.
   * Exactly the rows the reassignment feature exists for.
   */
  orphaned: boolean;
}

export const getAllProjects = cache(
  async (
    cursor?: string,
    limit: number = TABLE_PAGE_SIZE,
  ): Promise<{ rows: PlatformProject[]; nextCursor: string | null }> => {
    await requirePermission("project.metadata.view", PLATFORM);

    const rows = await db.project.findMany({
      orderBy: [{ workspace: { name: "asc" } }, { name: "asc" }],
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        avatarKey: true,
        visibility: true,
        createdAt: true,
        archivedAt: true,
        workspace: {
          select: { id: true, name: true, color: true, suspended: true },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        // Counts, not rows: the UI shows "14 issues", not their titles. A
        // `select` on `issues` would never belong here.
        _count: { select: { members: true, issues: true } },
      },
    });

    return {
      rows: await Promise.all(
        rows.map(async (p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          color: p.color,
          avatarUrl: await resolveAvatarUrl(p.avatarKey),
          visibility: p.visibility,
          createdAt: p.createdAt,
          archivedAt: p.archivedAt,
          workspace: p.workspace,
          owner: p.createdBy,
          memberCount: p._count.members,
          issueCount: p._count.issues,
          orphaned: p.createdBy === null || p._count.members === 0,
        })),
      ),
      nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
    };
  },
);

export const getPlatformStats = cache(async (): Promise<PlatformStats> => {
  await requirePlatformAccess();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    workspaces,
    users,
    projects,
    deactivatedUsers,
    orphanedProjects,
    recentBreakGlass,
  ] = await Promise.all([
    db.workspace.count(),
    db.user.count(),
    db.project.count(),
    db.user.count({ where: { deactivatedAt: { not: null } } }),
    db.project.count({
      where: { OR: [{ createdById: null }, { members: { none: {} } }] },
    }),
    db.auditLog.count({
      where: {
        action: "project.breakglass",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  return {
    workspaces,
    users,
    projects,
    deactivatedUsers,
    orphanedProjects,
    recentBreakGlass,
  };
});

/**
 * The audit log of the whole platform.
 *
 * `audit.view` and not `platform.access`: entering the area is one thing,
 * reading the log another. Anyone allowed to read it also sees their own
 * entries in it — a log that excludes its reader wouldn't be a log at all.
 */
export const getAuditEntries = cache(
  async (limit = ACTIVITY_PAGE_SIZE): Promise<ActivityPage> => {
    await requirePermission("audit.view", PLATFORM);
    const entries = await listAudit({ limit });
    return {
      entries,
      nextCursor:
        entries.length === limit ? entries[entries.length - 1].id : null,
    };
  },
);

// Target for the "back" button: the user's first workspace (or null).
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

// ─── Dashboard ────────────────────────────────────────────────────────────────
//
// Numbers over time: how much was created, and how that compares to the
// preceding period.
//
// Grouping happens in the database (`date_trunc`), not in JavaScript. The
// obvious approach — fetch every timestamp and count in memory — would, after
// a year of operation, transfer hundreds of thousands of rows just to show
// twelve numbers at the end. The axis itself, by contrast, is built in code
// (`lib/buckets.ts`): a `GROUP BY` only knows buckets that have something in
// them, and a quiet weekend would otherwise not be a zero but a gap.

/** One marker on the time axis with everything that fell into its bucket. */
export interface DashboardPoint {
  /** Start of the bucket, `YYYY-MM-DD`. */
  date: string;
  issues: number;
  comments: number;
  projects: number;
  users: number;
  workspaces: number;
  /** Successful sign-ins — from the audit log, not from `User`. */
  logins: number;
  /** Failed attempts: wrong password, unknown or deactivated account. */
  failedLogins: number;
}

/** What was created in the period. */
export interface DashboardTotals {
  issues: number;
  comments: number;
  projects: number;
  users: number;
  workspaces: number;
}

/** A workspace, measured by its scope — metadata, no content. */
export interface WorkspaceSize {
  id: string;
  name: string;
  color: string;
  issues: number;
  projects: number;
  members: number;
}

export interface DashboardData {
  range: RangeKey;
  unit: BucketUnit;
  points: DashboardPoint[];
  /** Created within the chosen period. */
  totals: DashboardTotals;
  /** Created in the equally long period before it — the baseline for trends. */
  previous: DashboardTotals;
  /** The total stock, independent of the period. */
  allTime: DashboardTotals;
  topWorkspaces: WorkspaceSize[];
}

/**
 * The tables the dashboard counts from — with the column that carries the
 * timestamp.
 *
 * Hardcoded and not determinable from outside: table and column names can't
 * be passed as parameters in SQL, they get written directly into the query.
 * If a value came in from outside here, that would be an open invitation.
 * That's why the list lives here, and `countsByBucket` only takes keys from it.
 */
const SOURCES = {
  issues: { table: "Issue", column: "created" },
  comments: { table: "Comment", column: "created" },
  projects: { table: "Project", column: "createdAt" },
  users: { table: "User", column: "createdAt" },
  workspaces: { table: "Workspace", column: "createdAt" },
} as const satisfies Record<string, { table: string; column: string }>;

type Source = keyof typeof SOURCES;

const SOURCE_KEYS = Object.keys(SOURCES) as Source[];

/**
 * How much was created per bucket.
 *
 * `date_trunc` gets the unit as a parameter — the first argument is text,
 * that's fine. Table and column, on the other hand, are identifiers and come
 * from `SOURCES`, never from outside.
 */
async function countsByBucket(
  source: Source,
  unit: BucketUnit,
  from: Date,
  to: Date,
): Promise<Map<string, number>> {
  const { table, column } = SOURCES[source];

  const rows = await db.$queryRaw<{ bucket: Date; count: bigint }[]>`
    SELECT date_trunc(${unit}, ${Prisma.raw(`"${column}"`)}) AS bucket,
           COUNT(*) AS count
      FROM ${Prisma.raw(`"${table}"`)}
     WHERE ${Prisma.raw(`"${column}"`)} >= ${from}
       AND ${Prisma.raw(`"${column}"`)} < ${to}
     GROUP BY 1
  `;

  return new Map(rows.map((row) => [bucketKey(row.bucket), Number(row.count)]));
}

/**
 * Sign-ins per bucket, successful and failed.
 *
 * The source is the audit log and not `User.lastSeenAt`: that column only
 * holds the most recent timestamp per account, from which no history can be
 * built. The audit log records every event individually — that's exactly
 * what it's for.
 *
 * Both series in one query: they only differ in one column. The keys come as
 * values from `lib/audit/actions.ts`, so that a rename there breaks the type
 * check here instead of silently returning an empty series.
 */
async function loginsByBucket(
  unit: BucketUnit,
  from: Date,
  to: Date,
): Promise<{ ok: Map<string, number>; failed: Map<string, number> }> {
  const success: AuditAction = "auth.login";
  const failure: AuditAction = "auth.login.failed";

  const rows = await db.$queryRaw<
    { bucket: Date; action: string; count: bigint }[]
  >`
    SELECT date_trunc(${unit}, "createdAt") AS bucket,
           "action",
           COUNT(*) AS count
      FROM "AuditLog"
     WHERE "createdAt" >= ${from}
       AND "createdAt" < ${to}
       AND "action" IN (${success}, ${failure})
     GROUP BY 1, 2
  `;

  const ok = new Map<string, number>();
  const failed = new Map<string, number>();
  for (const row of rows) {
    const target = row.action === success ? ok : failed;
    target.set(bucketKey(row.bucket), Number(row.count));
  }
  return { ok, failed };
}

/** How much there was in total within a time window. */
async function totalsIn(from: Date, to: Date): Promise<DashboardTotals> {
  const range = { gte: from, lt: to };
  const [issues, comments, projects, users, workspaces] = await Promise.all([
    db.issue.count({ where: { created: range } }),
    db.comment.count({ where: { created: range } }),
    db.project.count({ where: { createdAt: range } }),
    db.user.count({ where: { createdAt: range } }),
    db.workspace.count({ where: { createdAt: range } }),
  ]);
  return { issues, comments, projects, users, workspaces };
}

/**
 * The largest workspaces, measured by their issues.
 *
 * For the question of where the load lies — and who it's attributable to.
 * Counting happens across the workspace's projects; none of it is read.
 */
async function largestWorkspaces(limit: number): Promise<WorkspaceSize[]> {
  const rows = await db.workspace.findMany({
    select: {
      id: true,
      name: true,
      color: true,
      _count: { select: { projects: true, members: true } },
      projects: { select: { _count: { select: { issues: true } } } },
    },
  });

  return rows
    .map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      color: workspace.color,
      issues: workspace.projects.reduce((sum, p) => sum + p._count.issues, 0),
      projects: workspace._count.projects,
      members: workspace._count.members,
    }))
    .sort((a, b) => b.issues - a.issues || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export const getDashboard = cache(
  async (range: RangeKey): Promise<DashboardData> => {
    await requirePlatformAccess();

    const current = windowFor(range);
    const before = previousWindow(current, range);

    const [buckets, logins, totals, previous, allTime, topWorkspaces] =
      await Promise.all([
        Promise.all(
          SOURCE_KEYS.map((source) =>
            countsByBucket(source, current.unit, current.from, current.to),
          ),
        ),
        loginsByBucket(current.unit, current.from, current.to),
        totalsIn(current.from, current.to),
        totalsIn(before.from, before.to),
        // With no time bound: the total stock is the baseline against which
        // the movement in the period gains any meaning at all.
        totalsIn(new Date(0), new Date(8.64e15)),
        largestWorkspaces(5),
      ]);

    const byKey = new Map(
      SOURCE_KEYS.map((source, index) => [source, buckets[index]]),
    );

    // The axis leads, not the result of the grouping: every bucket appears,
    // even the empty one.
    const points: DashboardPoint[] = current.keys.map((date) => ({
      date,
      issues: byKey.get("issues")?.get(date) ?? 0,
      comments: byKey.get("comments")?.get(date) ?? 0,
      projects: byKey.get("projects")?.get(date) ?? 0,
      users: byKey.get("users")?.get(date) ?? 0,
      workspaces: byKey.get("workspaces")?.get(date) ?? 0,
      logins: logins.ok.get(date) ?? 0,
      failedLogins: logins.failed.get(date) ?? 0,
    }));

    return {
      range,
      unit: current.unit,
      points,
      totals,
      previous,
      allTime,
      topWorkspaces,
    };
  },
);

// ─── Workspaces ───────────────────────────────────────────────────────────────
//
// At this level, a workspace is a tenant: a shell with a name, someone
// responsible, a size, and a state. What's being worked on inside doesn't
// appear here either — `issues` is a count, and there's no path in from this
// list.

/** A workspace, as platform administration sees it. */
export interface PlatformWorkspace {
  id: string;
  name: string;
  slug: string;
  color: string;
  avatarUrl: string | null;
  createdAt: Date;
  /** Suspended: nobody gets in, not even leadership. */
  suspended: boolean;
  /**
   * Who runs it — the member with the owner role. Null if there is no
   * longer one: then the tenant is leaderless and nobody can administer it.
   */
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  } | null;
  members: number;
  projects: number;
  issues: number;
  /**
   * When an issue was last created. The rough measure of "is the tenant even
   * still being used" — null means: never.
   */
  lastActivityAt: Date | null;
}

/**
 * All workspaces on the platform.
 *
 * Only `platform.access` and no separate read permission: the same
 * information is already on the dashboard (totals, largest workspaces), and
 * both platform roles need it — support, to find a tenant; administration, to
 * manage it. An extra hurdle in front of the list wouldn't protect anything
 * that isn't visible one page over anyway.
 *
 * Taking action is a different question: `workspace.suspend` and
 * `workspace.delete` apply there (see `features/admin/actions.ts`).
 */
export const getAllWorkspaces = cache(
  async (
    cursor?: string,
    limit: number = TABLE_PAGE_SIZE,
  ): Promise<{ rows: PlatformWorkspace[]; nextCursor: string | null }> => {
    await requirePlatformAccess();

    const [rows, activity] = await Promise.all([
      db.workspace.findMany({
        orderBy: { name: "asc" },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          avatarKey: true,
          createdAt: true,
          suspended: true,
          _count: { select: { members: true, projects: true } },
          projects: { select: { _count: { select: { issues: true } } } },
          // Only leadership, not the member list: who's in the tenant shows
          // up in user management, and here what counts is who's responsible.
          members: {
            where: { role: { key: OWNER_ROLE_KEY } },
            take: 1,
            select: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      // One trip for all tenants. Joined via `Project`, because an issue
      // doesn't know its workspace directly.
      db.$queryRaw<{ workspaceId: string; last: Date | null }[]>`
        SELECT p."workspaceId" AS "workspaceId", MAX(i."created") AS last
          FROM "Issue" i
          JOIN "Project" p ON p."id" = i."projectId"
         GROUP BY 1
      `,
    ]);

    const lastByWorkspace = new Map(
      activity.map((row) => [row.workspaceId, row.last]),
    );

    return {
      rows: await Promise.all(
        rows.map(async (workspace) => ({
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          color: workspace.color,
          avatarUrl: await resolveAvatarUrl(workspace.avatarKey),
          createdAt: workspace.createdAt,
          suspended: workspace.suspended,
          owner: workspace.members[0]?.user ?? null,
          members: workspace._count.members,
          projects: workspace._count.projects,
          issues: workspace.projects.reduce(
            (sum, p) => sum + p._count.issues,
            0,
          ),
          lastActivityAt: lastByWorkspace.get(workspace.id) ?? null,
        })),
      ),
      nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
    };
  },
);
