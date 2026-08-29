import type { ProjectVisibility } from "@/features/projects/types";
import type { Project, Role, User } from "@/types";

// The workspace settings views. Each is exactly what one page renders:
// ready-made rows plus the question of what the actor is allowed to do
// with them. Permissions are resolved by the server — no component here
// reimplements rules.

/** An important external address of the workspace — documentation, repository, chat. */
export interface WorkspaceLinkRow {
  id: string;
  label: string;
  url: string;
}

/** General: the workspace's core data and what depends on it. */
export interface WorkspaceSettingsView {
  workspace: {
    id: string;
    name: string;
    slug: string;
    color: string;
    /** What the workspace is for — empty if nobody has said. */
    desc: string;
    avatarUrl: string | null;
    projectCount: number;
    memberCount: number;
    issueCount: number;
    links: WorkspaceLinkRow[];
    /** Email domains that let new accounts join automatically
     * (`addWorkspaceDomain`/`removeWorkspaceDomain`). */
    domains: string[];
  };
  /** `workspace.update` — name, color, description, and links. */
  canUpdate: boolean;
  /** `workspace.delete` — delete the workspace along with everything in it. */
  canDelete: boolean;
}

/**
 * A project along with the workspace it lives in.
 *
 * Needed by anyone listing projects across workspace boundaries: the name
 * alone no longer says which one is meant, and without the workspace id
 * there's no way to build an address for it either
 * (`/<workspaceId>/project/<slug>/…`).
 */
export interface ProjectWithWorkspace extends Project {
  workspaceId: string;
  workspaceName: string;
}

/** A project as the workspace's overview shows it. */
export interface WorkspaceProjectRow {
  id: string;
  name: string;
  slug: string;
  prefix: string;
  color: string;
  avatarUrl: string | null;
  /** What the project is for — empty if nobody has said. */
  desc: string;
  visibility: ProjectVisibility;
  issueCount: number;
  memberCount: number;
  /**
   * The first few members for the avatar stack — not the entire list. How
   * many there are in total is answered by `memberCount`; the faces answer
   * the other question ("am I in it, and who else?"), and four are enough
   * for that.
   */
  members: User[];
  /**
   * `project.update` in exactly this project. The permission is
   * project-local, so it decides row by row — leading a project by no
   * means grants the right to change all of them.
   */
  canUpdate: boolean;
  /** `project.delete` in exactly this project. */
  canDelete: boolean;
}

export interface WorkspaceProjectsView {
  /** The single list when `seesAllProjects` doesn't apply — empty
   * otherwise, see `publicRows`/`privateRows`. */
  rows: WorkspaceProjectRow[];
  /** Only with `seesAllProjects`: the public projects. */
  publicRows: WorkspaceProjectRow[];
  /** Only with `seesAllProjects`: the private projects. */
  privateRows: WorkspaceProjectRow[];
  /** `project.create` — create a new project in the workspace. */
  canCreate: boolean;
  /**
   * The actor sees every project in the workspace — via a master key
   * (`project.view.all`, `project.admin.all`) or as support.
   *
   * Only then is the list allowed to group by visibility: otherwise
   * "Private" wouldn't be the set of private projects, just the subset
   * they happen to be a member of — a heading that promises more than it
   * delivers.
   */
  seesAllProjects: boolean;
  /** Cursor for `rows` (without `seesAllProjects`), `null` otherwise. */
  nextCursor: string | null;
  /** Cursor for `publicRows`, `null` otherwise. */
  publicNextCursor: string | null;
  /** Cursor for `privateRows`, `null` otherwise. */
  privateNextCursor: string | null;
}

/** A label as the workspace's management page shows it. */
export interface WorkspaceLabelRow {
  id: string;
  name: string;
  /** Appears verbatim in filter URLs (`?label=…`) and stays put on rename. */
  slug: string;
  color: string;
  /** How many tasks in the workspace the label is attached to. */
  issueCount: number;
  /**
   * Only set for project labels: the name of the project it belongs to.
   * The workspace view lists them too, but they can only be changed where
   * they belong.
   */
  projectName?: string;
  /** Slug of the owning project — for the path to its labels. */
  projectSlug?: string;
  /** In how many projects this workspace label is hidden. */
  hiddenIn: number;
}

export interface WorkspaceLabelsView {
  /** Labels owned by the workspace: apply in every project. */
  own: WorkspaceLabelRow[];
  /** Labels owned by individual projects — listed here only for overview. */
  fromProjects: WorkspaceLabelRow[];
  /** `label.create` in workspace scope. */
  canCreate: boolean;
  /** `label.update` in workspace scope. */
  canUpdate: boolean;
  /** `label.delete` in workspace scope. */
  canDelete: boolean;
  /** Cursor for `own`, `null` when everything is already loaded. */
  ownNextCursor: string | null;
  /** Cursor for `fromProjects`, `null` when everything is already loaded. */
  fromProjectsNextCursor: string | null;
}

/**
 * A project attached to a team — with the role the team grants there.
 * `role` is `null` when the link exists purely for grouping, without
 * members gaining access through it.
 */
export interface TeamProjectRow {
  id: string;
  name: string;
  color: string;
  role: { key: string; name: string; rank: number } | null;
}

/** A team with everything its row shows. */
export interface WorkspaceTeamRow {
  id: string;
  name: string;
  /** Short code, unique within the workspace. */
  key: string;
  color: string;
  desc: string;
  /** The person leading the team. `null` if their account is gone. */
  lead: User | null;
  members: User[];
  projects: TeamProjectRow[];
  /** Open tasks across this team's projects. */
  openIssues: number;
}

export interface WorkspaceTeamsView {
  rows: WorkspaceTeamRow[];
  /** Selection for the dialog: workspace members. */
  candidates: User[];
  /** Selection for the dialog: workspace projects. */
  projects: { id: string; name: string; color: string }[];
  /**
   * Roles assignable to a project in the dialog — the workspace's project
   * roles (system or custom) that apply in all of its projects.
   * Project-local roles of individual projects are deliberately excluded
   * here: a team can span multiple projects, and a role that only exists
   * in one of them wouldn't be a valid choice in the others.
   *
   * Whether a chosen role can actually be assigned in the specific project
   * is checked server-side by `resolveTeamProjectRoles` on save — this list
   * is only the dialog's selection, not a guarantee.
   */
  assignableProjectRoles: { key: string; name: string; rank: number }[];
  /** `team.create` */
  canCreate: boolean;
  /** `team.update` — name, short code, color, lead. */
  canUpdate: boolean;
  /** `team.delete` */
  canDelete: boolean;
  /** `team.member.manage` — who is in the team. */
  canManageMembers: boolean;
  /** `team.project.manage` — which projects belong to the team, with which role. */
  canManageProjects: boolean;
  /** Id of the last team on this page, for `loadMoreWorkspaceTeams` —
   * `null` if `rows` is already everything. */
  nextCursor: string | null;
}

/** A workspace member as their row shows them. */
export interface WorkspaceMemberRow {
  user: User;
  /** Role key in the workspace. */
  role: string;
  roleName: string;
  roleRank: number;
  /** The invitation has not been accepted yet. */
  pending: boolean;
  /** Teams the person is on — name and color are enough for the row. */
  teams: { id: string; name: string; color: string }[];
  /** This is the currently logged-in user. */
  you: boolean;
  /**
   * Rank, self-reference, and owner protection don't stand in the way.
   * Decided by the server; which action is allowed is answered by
   * `canSetRole` and `canRemove`.
   */
  manageable: boolean;
}

export interface WorkspaceMembersView {
  rows: WorkspaceMemberRow[];
  /** Roles the current user is allowed to assign. Empty without management rights. */
  assignableRoles: Role[];
  /** `member.invite` */
  canInvite: boolean;
  /** `member.role.update` */
  canSetRole: boolean;
  /** `member.remove` */
  canRemove: boolean;
  /** Id of the last member on this page, for `loadMoreWorkspaceMembers` —
   * `null` if `rows` is already everything. */
  nextCursor: string | null;
}

/** A not-yet-accepted invitation as its row shows it. */
export interface PendingInvitationRow {
  token: string;
  email: string;
  /** Name of the shadow account — until accepted, just the local part of
   * the address (see `inviteOneWorkspaceMember`); after that the person no
   * longer appears here anyway. */
  firstName: string;
  lastName: string;
  roleName: string;
  /** `null` for rows predating the `invitedById` column, or when the
   * inviting account has since been deleted. */
  invitedByName: string | null;
  createdAt: Date;
  expires: Date;
  expired: boolean;
}

export interface PendingInvitationsView {
  rows: PendingInvitationRow[];
  /** `member.invite` — the same permission as for inviting itself. */
  canManage: boolean;
  /** Token of the last row on this page, for `loadMorePendingInvitations`
   * — `null` if `rows` is already everything. */
  nextCursor: string | null;
}

/** The shareable invitation link of a scope (workspace or project). */
export interface ActiveInviteLink {
  token: string;
  url: string;
  roleId: string;
  roleName: string;
  expiresAt: Date | null;
}

export interface InviteLinkView {
  /** `null` when no link is (yet) active. */
  activeLink: ActiveInviteLink | null;
  /** Roles the current user is allowed to assign. */
  assignableRoles: Role[];
  canManage: boolean;
}
