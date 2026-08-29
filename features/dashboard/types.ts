import type { DashboardScope } from "@/features/dashboard/scope";
import type { WidgetKey } from "@/features/dashboard/widgets";
import type { BucketUnit, RangeKey } from "@/lib/buckets";
import type { User } from "@/types";

// What a project's dashboard displays — fully computed, as everywhere in
// this project. The UI no longer sums, sorts, or filters anything: it just
// renders.

/** The key-figures row at the very top. */
export interface DashboardStats {
  /** Issues that are neither done nor discarded. */
  open: number;
  inProgress: number;
  inReview: number;
  /** Closed within the chosen period. */
  closed: number;
  /** Created within the chosen period — the counterpart to `closed`. */
  created: number;
  /** Open issues at the highest priority. */
  urgent: number;
  /** Of those, unassigned to anyone — an urgent issue with no name attached sits idle. */
  urgentUnassigned: number;
  /** All of the project's issues, with no time bound. */
  total: number;
  /**
   * Average cycle time in days, created to closed, across the issues closed
   * within the period. `null` if none was closed — "0 days" would be the
   * wrong answer to "none yet".
   */
  cycleDays: number | null;
}

/** A status with the number of issues in it. */
export interface StatusSlice {
  id: string;
  name: string;
  short: string;
  color: string;
  count: number;
}

/** A priority level with the number of open issues in it. */
export interface PrioritySlice {
  id: number;
  key: string;
  name: string;
  color: string;
  count: number;
}

/** A marker on the time axis: what was created and closed in its bucket. */
export interface ThroughputPoint {
  /** Start of the bucket, `YYYY-MM-DD`. */
  date: string;
  created: number;
  closed: number;
}

/** How many open issues sit with a person. */
export interface WorkloadRow {
  /** `null` stands for the unassigned pile. */
  user: User | null;
  open: number;
  /** Of those, in progress — the part someone is actually sitting on right now. */
  inProgress: number;
}

/** An issue, the way the two lists below display it. */
export interface DashboardIssue {
  id: string;
  /** `NIM-142` — the reference you'd search for it by. */
  ref: string;
  title: string;
  status: string;
  statusColor: string;
  priority: number;
  assignee: User | null;
  /** Timestamp of the last change, in milliseconds. */
  updated: number;
}

/**
 * Why an issue appears in "needs attention".
 *
 * An issue can have several reasons; the most severe one is shown. The
 * order here is the order of precedence.
 */
export type AttentionReason =
  /** Urgent and assigned to nobody. */
  | "unassigned"
  /** Urgent or high, and open. */
  | "urgent"
  /** In progress, but untouched for two weeks. */
  | "stale";

export interface AttentionIssue extends DashboardIssue {
  reason: AttentionReason;
}

export interface ProjectDashboardData {
  range: RangeKey;
  unit: BucketUnit;
  /**
   * Who these numbers refer to — "all" (the whole project or workspace) or
   * "mine" (only your own issues). The scope actually applied, not the one
   * requested: anyone without `dashboard.view.all` always gets "mine" here,
   * regardless of what `?scope=` says in the address.
   */
  scope: DashboardScope;
  stats: DashboardStats;
  statuses: StatusSlice[];
  priorities: PrioritySlice[];
  throughput: ThroughputPoint[];
  workload: WorkloadRow[];
  attention: AttentionIssue[];
}

/** A team with access to this project. */
export interface ProjectTeam {
  id: string;
  name: string;
  key: string;
  color: string;
}

/** A label assignable in this project. */
export interface ProjectLabel {
  id: string;
  name: string;
  color: string;
  /** The URL slug — filters appear as a slug in the address, not an id. */
  slug: string;
  /** Belongs to the project alone, not the whole workspace. */
  own: boolean;
}

/**
 * Everyone who holds the same role in the project.
 *
 * The groups arrive pre-sorted from the server (strongest role first) and
 * carry the role's name as it's stored in the database — not one from a
 * fixed list in code. If a workspace creates a project-specific "Moderator"
 * role, it appears here automatically as its own group with its own name,
 * with nothing needing to be updated here.
 */
export interface ProjectRoleGroup {
  /** The role key, also the group's React key. */
  key: string;
  name: string;
  /** The role's rank — determines order and color (`roleColor`). */
  rank: number;
  /**
   * Does this role carry more than just contributing? Such groups appear at
   * the top with names, the rest as a compact list below — see
   * `ProjectProfileView`.
   */
  distinguished: boolean;
  members: User[];
}

/**
 * The project's profile card — what it is, who owns it, what it consists of.
 *
 * Deliberately separate from `ProjectDashboardData`: nothing here changes
 * with the time period. A reference prefix doesn't have 30 days.
 */
export interface ProjectProfile {
  /** What the project is for. Empty means nobody's said. */
  desc: string;
  /** `NIM` — the prefix the issues run under. */
  prefix: string;
  visibility: "public" | "private";
  createdAt: number;
  createdBy: User | null;
  /**
   * `project.update` — whether the edit button appears in the header card.
   *
   * Pure visibility, no protection: the settings page behind it checks for
   * itself. The button is only hidden from everyone else because it would
   * otherwise lead to a page with nothing to change.
   */
  canUpdate: boolean;
  /**
   * `role.manage` OR `label.create` OR `project.update` — the same bar as
   * for the settings tab (`lib/nav.ts`, `PROJECT_NAV`). Without one of the
   * three, there'd only be read-only views to see there anyway.
   */
  canViewSettings: boolean;
  /**
   * `dashboard.view.all` — whether the toggle between "mine" and "whole
   * project" appears on the dashboard. Without this permission, the person
   * only ever sees their dashboard with `scope: "mine"` anyway
   * (`getProjectDashboard` enforces that) — this only states whether they
   * can even choose.
   */
  canViewAllStats: boolean;
  /** `label.create` — whether the labels card shows an add button. */
  canCreateLabel: boolean;
  /**
   * `team.project.manage` — whether the teams card shows an arrow to team
   * management. A workspace permission, checked in the workspace context:
   * teams belong to the workspace, not the project, and are managed there
   * too (`workspaceSettingsPath(workspaceId, "teams")`) — so this same card
   * can only link there, not edit anything itself.
   */
  canManageTeams: boolean;
  /** Who has access, grouped by role. Strongest role first. */
  roles: ProjectRoleGroup[];
  /** How many people in total — the sum across all groups. */
  memberCount: number;
  teams: ProjectTeam[];
  labels: ProjectLabel[];
}

/** What the page needs: the numbers, the profile card, and the layout. */
export interface ProjectDashboardView {
  project: {
    id: string;
    name: string;
    slug: string;
    color: string;
    avatarUrl: string | null;
  };
  data: ProjectDashboardData;
  profile: ProjectProfile;
  /** Visible widgets in their order, plus the deselected ones. */
  order: WidgetKey[];
  hidden: WidgetKey[];
}

// ─── The same, one level up: the workspace ───────────────────────────────────
//
// The same widgets as for a project, just summed across all of its projects
// — `WorkspaceDashboardData` therefore has the same shape as
// `ProjectDashboardData` and no shape of its own.

export type WorkspaceDashboardData = ProjectDashboardData;

/** A project in the workspace, as the profile card links to it. */
export interface WorkspaceProjectSummary {
  id: string;
  name: string;
  slug: string;
  color: string;
  avatarUrl: string | null;
}

/**
 * Everyone who holds the same role in the workspace — the same shape as
 * `ProjectRoleGroup` one level down, just grouped by `WorkspaceMember.role`
 * instead of `ProjectMember.role`.
 */
export type WorkspaceRoleGroup = ProjectRoleGroup;

/** An important external address — documentation, repository, chat. */
export interface WorkspaceLink {
  id: string;
  label: string;
  url: string;
}

/**
 * The workspace's profile card — what it is, who owns it, what it consists of.
 *
 * No `prefix`: the workspace doesn't have one, unlike a project. In its
 * place, the count of its projects — the one piece of information the
 * project's profile card doesn't need, since it's always one there.
 */
export interface WorkspaceProfile {
  /** What the workspace is for. Empty means nobody's said. */
  desc: string;
  createdAt: number;
  /** `workspace.update` — whether the edit button appears in the header card. */
  canUpdate: boolean;
  /**
   * `member.view` — whether `roles` shows the full roster (member/viewer/
   * guest) or only leadership. Also controls whether `memberCount` and the
   * link to the full member list appear — the page behind it stays locked
   * without this permission anyway.
   */
  canViewMembers: boolean;
  /**
   * `role.manage` OR `label.create` OR `workspace.update` — the same bar as
   * for the settings tab (`lib/nav.ts`, `WORKSPACE_NAV`). Without one of the
   * three, there'd only be read-only views to see there anyway.
   */
  canViewSettings: boolean;
  /** `dashboard.view.all` — see `ProjectProfile.canViewAllStats`. */
  canViewAllStats: boolean;
  /**
   * Leadership always appears (`distinguished`) — contributors and readers
   * only with `member.view` (see `canViewMembers`). Without that permission,
   * the list contains only the distinguished groups.
   */
  roles: WorkspaceRoleGroup[];
  /**
   * `platform_admin`/`platform_support` with reach into this workspace, with
   * no `WorkspaceMember` row of their own — otherwise they'd stay invisible
   * in the profile card despite being able to do more than almost anyone in
   * `roles`. Visible independent of `member.view`, like leadership there.
   * Doesn't count toward `memberCount` — that stays the size of actual
   * membership.
   */
  platformStaff: WorkspaceRoleGroup[];
  memberCount: number;
  teams: ProjectTeam[];
  projects: WorkspaceProjectSummary[];
  /** Important addresses, as large chips directly below the header card. */
  links: WorkspaceLink[];
  /** Whether the teams or projects card shows an add button. */
  canCreateProject: boolean;
  canCreateTeam: boolean;
  /** For the team dialog from the overview — the same permissions as on the teams page. */
  canManageTeamMembers: boolean;
  canManageTeamProjects: boolean;
  /** For the team dialog from the overview — see `WorkspaceTeamsView.assignableProjectRoles`. */
  assignableProjectRoles: { key: string; name: string; rank: number }[];
}

/** What the workspace page needs: the numbers, the profile card, the layout. */
export interface WorkspaceDashboardView {
  workspace: {
    id: string;
    name: string;
    slug: string;
    color: string;
    avatarUrl: string | null;
  };
  data: WorkspaceDashboardData;
  profile: WorkspaceProfile;
  order: WidgetKey[];
  hidden: WidgetKey[];
}
