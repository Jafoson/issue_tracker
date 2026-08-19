import "server-only";
import { cache } from "react";
import {
  getIssueTypes,
  getLabels,
  getMembers,
  getPriorities,
  getProjects,
  getRoles,
  getSearchIssues,
  getStatuses,
  getUserWorkspaces,
  getWorkspace,
} from "@/features/issues/queries";
import type { ProjectVisibility } from "@/features/projects/types";
import type {
  InviteLinkView,
  PendingInvitationRow,
  PendingInvitationsView,
  ProjectWithWorkspace,
  TeamProjectRow,
  WorkspaceLabelRow,
  WorkspaceLabelsView,
  WorkspaceMemberRow,
  WorkspaceMembersView,
  WorkspaceProjectRow,
  WorkspaceProjectsView,
  WorkspaceSettingsView,
  WorkspaceTeamRow,
  WorkspaceTeamsView,
} from "@/features/workspaces/types";
import { getCurrentWorkspaceId } from "@/lib/current-workspace";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { inviteLinkUrl } from "@/lib/invite-links";
import { TABLE_PAGE_SIZE } from "@/lib/pagination";
import {
  accessFor,
  assignmentCeiling,
  currentUserCanEnterWorkspace,
  currentUserId,
  visibleProjectIds,
} from "@/lib/permissions";
import { OWNER_ROLE_KEY } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { resolveAvatarUrl } from "@/lib/storage";
import { CLOSED_STATUSES } from "@/lib/workspace-defaults";
import type {
  IssueType,
  Label,
  Priority,
  Project,
  Role,
  SearchableIssue,
  Status,
  User,
  Workspace,
} from "@/types";

// Serverseitiger Ersatz für den früheren `useWorkspace()`-Client-Context —
// dasselbe Muster wie `getSession()`: kein Prop-Drilling, kein Provider nötig,
// direkt aus jeder Server Component aufrufbar. Die aktive Workspace-ID kommt aus
// dem Request-Store (`lib/current-workspace.ts`), den das App-Layout seedet.
//
// Alle Funktionen sind über `cache()` pro Request dedupliziert — mehrfache
// Aufrufe aus verschiedenen Komponenten kosten nur eine DB-Abfrage.

/** Aktive Workspace-ID, oder Fehler außerhalb der Workspace-Shell (z.B. /admin). */
function requireWorkspaceId(): string {
  const id = getCurrentWorkspaceId();
  if (!id) {
    throw new Error(
      "Kein aktiver Workspace im Request — diese Query ist nur innerhalb der Workspace-Shell nutzbar.",
    );
  }
  return id;
}

/** Aktueller Workspace, oder `null` außerhalb der Workspace-Shell. Analog zu `getSession()`. */
export const getCurrentWorkspace = cache(
  async (): Promise<Workspace | null> => {
    const id = getCurrentWorkspaceId();
    return id ? getWorkspace(id) : null;
  },
);

/** Alle Workspaces des eingeloggten Users. */
export const getMyWorkspaces = cache(async (): Promise<Workspace[]> => {
  const session = await getSession();
  return session ? getUserWorkspaces(session.userId) : [];
});

/**
 * Jedes Projekt, das der eingeloggte User sehen darf — über alle seine
 * Workspaces hinweg, nicht nur den offenen.
 *
 * Gedacht für Navigationen, die über die Grenze eines Workspace hinausreichen
 * (der Projektwechsler in den Einstellungen). `getProjects` bringt die
 * Sichtbarkeitsregel schon mit: was es liefert, sind genau die Projekte mit
 * `project.view` — dieselbe Hürde, an der die Projekteinstellungen hängen. Was
 * hier steht, ist also auch erreichbar.
 *
 * Kostet eine Auflösung je Workspace (`accessibleProjectIds`), nicht je Projekt.
 * Wer in vielen Workspaces ist, zahlt das entsprechend oft — beides ist `cache`d
 * und fällt pro Anfrage nur einmal an.
 */
export const getMyProjects = cache(
  async (): Promise<ProjectWithWorkspace[]> => {
    const workspaces = await getMyWorkspaces();
    const lists = await Promise.all(workspaces.map((ws) => getProjects(ws.id)));
    return workspaces.flatMap((ws, i) =>
      (lists[i] ?? []).map((project) => ({
        ...project,
        workspaceId: ws.id,
        workspaceName: ws.name,
      })),
    );
  },
);

/**
 * Der eingeloggte User als Mitglied des aktiven Workspace.
 *
 * Der Regelfall ist die Zeile aus der Mitgliederliste — sie bringt Rolle und Rang
 * mit. Wer nicht darin steht, ist damit aber nicht niemand: ein Projekt-Gast ist
 * zu genau einem Projekt eingeladen und hat keine Workspace-Mitgliedschaft. Für
 * ihn kommen die Angaben direkt aus seinem Konto, ohne Rolle.
 *
 * Ohne diesen zweiten Weg wäre `getMe()` für Gäste `null` — und weil die
 * Issue-Oberfläche daran hängt (`getIssueComposerData`), liefen sie überall in ein
 * 404, obwohl ihr Zugriff auf das Projekt in Ordnung ist.
 */
export const getMe = cache(async (): Promise<User | null> => {
  const session = await getSession();
  if (!session) return null;

  const members = await getWorkspaceMembers();
  const member = members.find((m) => m.id === session.userId);
  if (member) return member;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      handle: true,
      email: true,
      color: true,
      image: true,
      avatarKey: true,
    },
  });
  if (!user) return null;

  const image = (await resolveAvatarUrl(user.avatarKey)) ?? user.image;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    handle: user.handle,
    email: user.email,
    color: user.color,
    ...(image ? { image } : {}),
  };
});

export const getWorkspaceMembers = cache(
  async (): Promise<User[]> => getMembers(requireWorkspaceId()),
);

export const getWorkspaceProjects = cache(
  async (): Promise<Project[]> => getProjects(requireWorkspaceId()),
);

export const getWorkspaceLabels = cache(
  async (): Promise<Label[]> => getLabels(requireWorkspaceId()),
);

export const getWorkspaceStatuses = cache(
  async (): Promise<Status[]> => getStatuses(requireWorkspaceId()),
);

export const getWorkspacePriorities = cache(
  async (): Promise<Priority[]> => getPriorities(requireWorkspaceId()),
);

export const getWorkspaceIssueTypes = cache(
  async (): Promise<IssueType[]> => getIssueTypes(requireWorkspaceId()),
);

export const getWorkspaceRoles = cache(
  async (): Promise<Role[]> => getRoles(requireWorkspaceId()),
);

export const getWorkspaceSearchIssues = cache(
  async (): Promise<SearchableIssue[]> => getSearchIssues(requireWorkspaceId()),
);

// ─── Einstellungen des Workspace ──────────────────────────────────────────────
//
// Fünf Ansichten, eine je Bereich der Einstellungsseite. Aufgebaut wie die des
// Projekts (`features/projects/queries.ts`): jede liefert fertige Zeilen samt
// der Rechte, die dazu gehören, und `null` heißt „gibt es für dich nicht" —
// die Seite macht daraus ein 404, ohne zu verraten, ob der Workspace fehlt oder
// der Zutritt.
//
// Der Zutritt selbst ist keine Permission (siehe `canEnterWorkspace`): wer nicht
// dazugehört, bekommt hier gar nichts, auch nicht die leere Liste.

/** Stammdaten des Workspace samt dem, was an ihm hängt. */
export const getWorkspaceSettingsView = cache(
  async (): Promise<WorkspaceSettingsView | null> => {
    const workspaceId = requireWorkspaceId();
    if (!(await currentUserCanEnterWorkspace(workspaceId))) return null;

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        desc: true,
        avatarKey: true,
        _count: { select: { projects: true, members: true } },
        links: {
          select: { id: true, label: true, url: true },
          orderBy: { position: "asc" },
        },
        domains: {
          select: { domain: true },
          orderBy: { domain: "asc" },
        },
      },
    });
    if (!workspace) return null;

    // Die Gesamtzahl, nicht die der sichtbaren Projekte: sie steht in der
    // Warnung vor dem Löschen und muss deshalb die Wahrheit sagen.
    const issueCount = await db.issue.count({
      where: { project: { workspaceId } },
    });

    const access = await accessFor(await currentUserId(), { workspaceId });

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        color: workspace.color,
        desc: workspace.desc,
        avatarUrl: await resolveAvatarUrl(workspace.avatarKey),
        projectCount: workspace._count.projects,
        memberCount: workspace._count.members,
        issueCount,
        links: workspace.links,
        domains: workspace.domains.map((d) => d.domain),
      },
      canUpdate: access.has("workspace.update"),
      canDelete: access.has("workspace.delete"),
    };
  },
);

/**
 * Die Projekte des Workspace als Übersicht — mit den Rechten je Zeile.
 *
 * `project.update` und `project.delete` gelten im Projekt, nicht im Workspace.
 * Sie werden deshalb je Projekt aufgelöst: wer eines leitet, darf noch lange
 * nicht alle ändern. Die Leitung des Workspace greift über `project.admin.all`
 * ohnehin überall durch — auch das entscheidet der Resolver, nicht diese Liste.
 */
const workspaceProjectSelect = {
  id: true,
  name: true,
  slug: true,
  prefix: true,
  color: true,
  avatarKey: true,
  desc: true,
  visibility: true,
  _count: { select: { issues: true, members: true } },
  // Nur die ersten vier: mehr zeigt der Avatar-Stapel ohnehin nicht, und die
  // Gesamtzahl steht daneben (`_count.members`).
  members: {
    select: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          color: true,
          image: true,
          avatarKey: true,
        },
      },
    },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    take: 4,
  },
} satisfies Prisma.ProjectSelect;

async function toWorkspaceProjectRows(
  projects: Prisma.ProjectGetPayload<{
    select: typeof workspaceProjectSelect;
  }>[],
  userId: string | null,
): Promise<WorkspaceProjectRow[]> {
  return Promise.all(
    projects.map(async (project): Promise<WorkspaceProjectRow> => {
      const access = await accessFor(userId, { projectId: project.id });
      return {
        id: project.id,
        name: project.name,
        slug: project.slug,
        prefix: project.prefix,
        color: project.color,
        avatarUrl: await resolveAvatarUrl(project.avatarKey),
        desc: project.desc,
        visibility: project.visibility as ProjectVisibility,
        issueCount: project._count.issues,
        memberCount: project._count.members,
        members: await Promise.all(
          project.members.map(async (m) => {
            const { avatarKey, ...user } = m.user;
            return {
              ...user,
              image:
                (await resolveAvatarUrl(avatarKey)) ?? user.image ?? undefined,
            };
          }),
        ),
        canUpdate: access.has("project.update"),
        canDelete: access.has("project.delete"),
      };
    }),
  );
}

export const getWorkspaceProjectsView = cache(
  async (
    cursor?: string,
    publicCursor?: string,
    privateCursor?: string,
    limit: number = TABLE_PAGE_SIZE,
  ): Promise<WorkspaceProjectsView | null> => {
    const workspaceId = requireWorkspaceId();
    if (!(await currentUserCanEnterWorkspace(workspaceId))) return null;

    const userId = await currentUserId();
    const visible = await visibleProjectIds(workspaceId);
    const access = await accessFor(userId, { workspaceId });
    // Dieselben Generalschlüssel, die `accessibleProjectIds` alle Projekte
    // aufschließen — nur hier im Workspace-Scope gefragt, wo Support ohnehin
    // jedes Recht trägt. Wer sie hat, darf die Liste nach Sichtbarkeit trennen.
    const seesAllProjects =
      access.has("project.view.all") || access.has("project.admin.all");
    const canCreate = access.has("project.create");

    if (seesAllProjects) {
      const [publicProjects, privateProjects] = await Promise.all([
        db.project.findMany({
          where: {
            workspaceId,
            id: { in: [...visible] },
            visibility: "public",
          },
          select: workspaceProjectSelect,
          orderBy: { name: "asc" },
          take: limit,
          ...(publicCursor ? { cursor: { id: publicCursor }, skip: 1 } : {}),
        }),
        db.project.findMany({
          where: {
            workspaceId,
            id: { in: [...visible] },
            visibility: "private",
          },
          select: workspaceProjectSelect,
          orderBy: { name: "asc" },
          take: limit,
          ...(privateCursor ? { cursor: { id: privateCursor }, skip: 1 } : {}),
        }),
      ]);

      return {
        rows: [],
        publicRows: await toWorkspaceProjectRows(publicProjects, userId),
        privateRows: await toWorkspaceProjectRows(privateProjects, userId),
        canCreate,
        seesAllProjects,
        nextCursor: null,
        publicNextCursor:
          publicProjects.length === limit
            ? publicProjects[publicProjects.length - 1].id
            : null,
        privateNextCursor:
          privateProjects.length === limit
            ? privateProjects[privateProjects.length - 1].id
            : null,
      };
    }

    const projects = await db.project.findMany({
      where: { workspaceId, id: { in: [...visible] } },
      select: workspaceProjectSelect,
      orderBy: { name: "asc" },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return {
      rows: await toWorkspaceProjectRows(projects, userId),
      publicRows: [],
      privateRows: [],
      canCreate,
      seesAllProjects,
      nextCursor:
        projects.length === limit ? projects[projects.length - 1].id : null,
      publicNextCursor: null,
      privateNextCursor: null,
    };
  },
);

/**
 * Die Labels des Workspace, getrennt von denen seiner Projekte.
 *
 * Oben, was überall gilt und sich hier ändern lässt. Darunter, was einzelnen
 * Projekten gehört: dieselben Spalten, aber nur zum Nachsehen — die
 * `label.*`-Rechte werden hier im Workspace-Scope aufgelöst, und der reicht für
 * ein Projekt-Label nicht (`features/issues/actions.ts`, `labelScope`).
 */
export const getWorkspaceLabelsView = cache(
  async (
    ownCursor?: string,
    fromProjectsCursor?: string,
    limit: number = TABLE_PAGE_SIZE,
  ): Promise<WorkspaceLabelsView | null> => {
    const workspaceId = requireWorkspaceId();
    if (!(await currentUserCanEnterWorkspace(workspaceId))) return null;

    const labelSelect = {
      id: true,
      name: true,
      slug: true,
      color: true,
      project: { select: { name: true, slug: true } },
    } as const;

    const [ownLabels, projectLabels, tagged, hidden] = await Promise.all([
      db.label.findMany({
        where: { workspaceId, projectId: null },
        select: labelSelect,
        orderBy: { name: "asc" },
        take: limit,
        ...(ownCursor ? { cursor: { id: ownCursor }, skip: 1 } : {}),
      }),
      db.label.findMany({
        where: { workspaceId, projectId: { not: null } },
        select: labelSelect,
        orderBy: { name: "asc" },
        take: limit,
        ...(fromProjectsCursor
          ? { cursor: { id: fromProjectsCursor }, skip: 1 }
          : {}),
      }),
      // `Issue.labels` ist ein ID-Array ohne Fremdschlüssel — zählen lässt es
      // sich nur, indem man die Arrays des Workspace einmal durchgeht.
      db.issue.findMany({
        where: { project: { workspaceId } },
        select: { labels: true },
      }),
      db.projectHiddenLabel.groupBy({
        by: ["labelId"],
        where: { project: { workspaceId } },
        _count: { labelId: true },
      }),
    ]);

    const used = new Map<string, number>();
    for (const issue of tagged) {
      for (const id of issue.labels) used.set(id, (used.get(id) ?? 0) + 1);
    }
    const hiddenIn = new Map(hidden.map((h) => [h.labelId, h._count.labelId]));

    const toRow = (l: (typeof ownLabels)[number]): WorkspaceLabelRow => ({
      id: l.id,
      name: l.name,
      slug: l.slug,
      color: l.color,
      issueCount: used.get(l.id) ?? 0,
      hiddenIn: hiddenIn.get(l.id) ?? 0,
      ...(l.project
        ? { projectName: l.project.name, projectSlug: l.project.slug }
        : {}),
    });

    const access = await accessFor(await currentUserId(), { workspaceId });

    return {
      own: ownLabels.map(toRow),
      fromProjects: projectLabels.map(toRow),
      canCreate: access.has("label.create"),
      canUpdate: access.has("label.update"),
      canDelete: access.has("label.delete"),
      ownNextCursor:
        ownLabels.length === limit ? ownLabels[ownLabels.length - 1].id : null,
      fromProjectsNextCursor:
        projectLabels.length === limit
          ? projectLabels[projectLabels.length - 1].id
          : null,
    };
  },
);

/**
 * Die Teams des Workspace — wer darin ist, woran sie arbeiten, wie viel offen ist.
 *
 * Ein Team gruppiert Menschen und Projekte. Rechte vergibt es nur noch dort,
 * wo eine `TeamProject`-Verknüpfung ausdrücklich eine Rolle trägt — die landet
 * dann ganz normal in `ProjectMember` (`syncProjectTeamRoles`,
 * lib/project-membership.ts) und wirkt über den üblichen Pfad. Für das Lesen
 * hier genügt trotzdem der bloße Zutritt zum Workspace; die fünf `team.*`-
 * Rechte entscheiden nur über das Ändern.
 */
export const getWorkspaceTeamsView = cache(
  async (
    cursor?: string,
    limit: number = TABLE_PAGE_SIZE,
  ): Promise<WorkspaceTeamsView | null> => {
    const workspaceId = requireWorkspaceId();
    if (!(await currentUserCanEnterWorkspace(workspaceId))) return null;

    const actorId = await currentUserId();
    const access = await accessFor(actorId, { workspaceId });
    // Ohne `team.view.all` nur die Teams, in denen man selbst Mitglied ist —
    // kein Gate wie bei den Mitgliedern, sondern eine gefilterte statt leeren
    // Liste (`lib/rbac/permissions.ts`).
    const canViewAllTeams = access.has("team.view.all");

    const [teams, members, projects, assignableProjectRoles] =
      await Promise.all([
        db.team.findMany({
          where: {
            workspaceId,
            ...(canViewAllTeams || !actorId
              ? {}
              : { members: { some: { userId: actorId } } }),
          },
          include: {
            lead: true,
            members: { select: { userId: true } },
            projects: {
              select: {
                projectId: true,
                role: { select: { key: true, name: true, rank: true } },
              },
            },
          },
          orderBy: { name: "asc" },
          take: limit,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
        getMembers(workspaceId),
        db.project.findMany({
          where: { workspaceId },
          select: { id: true, name: true, color: true },
          orderBy: { name: "asc" },
        }),
        // Projektrollen, die in allen Projekten des Workspace gelten — die
        // einzigen, die sich einem Team ohne Rücksicht auf ein bestimmtes
        // Projekt anbieten lassen. Siehe Kommentar an
        // `WorkspaceTeamsView.assignableProjectRoles`.
        db.role.findMany({
          where: {
            scope: "PROJECT",
            OR: [{ system: true }, { workspaceId, projectId: null }],
          },
          select: { key: true, name: true, rank: true },
          orderBy: { rank: "desc" },
        }),
      ]);

    // Eine Abfrage für alle Teams statt einer je Team: die offenen Aufgaben je
    // Projekt einmal zählen und anschließend zuordnen.
    const openPerProject = await db.issue.groupBy({
      by: ["projectId"],
      where: {
        project: { workspaceId },
        status: { notIn: [...CLOSED_STATUSES] },
      },
      _count: { _all: true },
    });
    const openOf = new Map(
      openPerProject.map((p) => [p.projectId, p._count._all]),
    );

    const userById = new Map(members.map((m) => [m.id, m]));
    const projectById = new Map(projects.map((p) => [p.id, p]));

    const rows: WorkspaceTeamRow[] = await Promise.all(
      teams.map(async (team) => {
        const teamProjects: TeamProjectRow[] = team.projects
          .map((p) => {
            const project = projectById.get(p.projectId);
            if (!project) return undefined;
            return { ...project, role: p.role };
          })
          .filter((p) => p !== undefined);

        const leadImage =
          (await resolveAvatarUrl(team.lead.avatarKey)) ?? team.lead.image;

        return {
          id: team.id,
          name: team.name,
          key: team.key,
          color: team.color,
          desc: team.desc,
          // Der Lead steht über den Fremdschlüssel fest und muss kein
          // Workspace-Mitglied mehr sein — dann fehlt er in `members`, und die
          // Zeile nimmt seine Stammdaten direkt aus der Beziehung.
          lead: userById.get(team.leadId) ?? {
            id: team.lead.id,
            firstName: team.lead.firstName,
            lastName: team.lead.lastName,
            email: team.lead.email,
            color: team.lead.color,
            ...(leadImage ? { image: leadImage } : {}),
          },
          members: team.members
            .map((m) => userById.get(m.userId))
            .filter((m) => m !== undefined),
          projects: teamProjects,
          openIssues: teamProjects.reduce(
            (sum, p) => sum + (openOf.get(p.id) ?? 0),
            0,
          ),
        };
      }),
    );

    return {
      rows,
      candidates: members,
      projects,
      assignableProjectRoles,
      canCreate: access.has("team.create"),
      canUpdate: access.has("team.update"),
      canDelete: access.has("team.delete"),
      canManageMembers: access.has("team.member.manage"),
      canManageProjects: access.has("team.project.manage"),
      nextCursor: teams.length === limit ? teams[teams.length - 1].id : null,
    };
  },
);

/**
 * Die Mitglieder des Workspace mit Rolle, Teams und Status.
 *
 * Die Rangregeln stehen doppelt: hier für die Oberfläche und in den Actions für
 * die Wirkung (`setMemberRole`, `removeMember`). Verglichen wird beidseitig der
 * Rang der **eigenen Workspace-Rolle** — nicht die Obergrenze aus
 * `assignmentCeiling`. Wer im Workspace gar keine Rolle trägt (Support-Zugriff
 * über `tenant.access`), käme sonst zu einer Auswahl, die jede Action ablehnt.
 */
export const getWorkspaceMembersView = cache(
  async (
    cursor?: string,
    limit: number = TABLE_PAGE_SIZE,
  ): Promise<WorkspaceMembersView | null> => {
    const workspaceId = requireWorkspaceId();
    if (!(await currentUserCanEnterWorkspace(workspaceId))) return null;

    const actorId = await currentUserId();
    const access = await accessFor(actorId, { workspaceId });
    if (!access.has("member.view")) return null;

    const [rowsRaw, teams, roles] = await Promise.all([
      db.workspaceMember.findMany({
        where: { workspaceId },
        include: {
          user: true,
          role: { select: { key: true, name: true, rank: true } },
        },
        orderBy: [
          { user: { firstName: "asc" } },
          { user: { lastName: "asc" } },
        ],
        take: limit,
        ...(cursor
          ? {
              cursor: { workspaceId_userId: { workspaceId, userId: cursor } },
              skip: 1,
            }
          : {}),
      }),
      db.team.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          color: true,
          members: { select: { userId: true } },
        },
        orderBy: { name: "asc" },
      }),
      getRoles(workspaceId),
    ]);

    const canInvite = access.has("member.invite");
    const canSetRole = access.has("member.role.update");
    const canRemove = access.has("member.remove");
    const actorRank = access.rank("WORKSPACE");

    const teamsOf = new Map<
      string,
      { id: string; name: string; color: string }[]
    >();
    for (const team of teams) {
      for (const member of team.members) {
        const list = teamsOf.get(member.userId) ?? [];
        list.push({ id: team.id, name: team.name, color: team.color });
        teamsOf.set(member.userId, list);
      }
    }

    const rows: WorkspaceMemberRow[] = await Promise.all(
      rowsRaw.map(async (m) => {
        const image =
          (await resolveAvatarUrl(m.user.avatarKey)) ?? m.user.image;
        return {
          user: {
            id: m.user.id,
            firstName: m.user.firstName,
            lastName: m.user.lastName,
            handle: m.user.handle,
            email: m.user.email,
            color: m.user.color,
            ...(image ? { image } : {}),
            role: m.role.key,
            roleRank: m.role.rank,
            pending: m.pending,
          },
          role: m.role.key,
          roleName: m.role.name,
          roleRank: m.role.rank,
          pending: m.pending,
          teams: teamsOf.get(m.userId) ?? [],
          you: m.userId === actorId,
          // Der Owner bleibt unangetastet — zum Owner führt nur ein
          // Ownership-Transfer, und aus der Rolle heraus führt kein Knopf.
          manageable:
            (canSetRole || canRemove) &&
            m.userId !== actorId &&
            m.role.key !== OWNER_ROLE_KEY &&
            m.role.rank <= actorRank,
        };
      }),
    );

    const assignableRoles =
      canSetRole || canInvite
        ? roles.filter((r) => r.id !== OWNER_ROLE_KEY && r.rank <= actorRank)
        : [];

    return {
      rows,
      assignableRoles,
      canInvite,
      canSetRole,
      canRemove,
      nextCursor:
        rowsRaw.length === limit ? rowsRaw[rowsRaw.length - 1].userId : null,
    };
  },
);

/**
 * Offene Einladungen des Workspace — noch nicht angenommen, unabhängig davon,
 * ob sie schon abgelaufen sind (die Zeile zeigt das, statt sie auszublenden).
 *
 * Nur die Workspace-weiten Einladungen: eine mit `projectId` gehört zu einem
 * Projekt-Gast ohne Workspace-Mitgliedschaft (siehe `inviteOneProjectMember`)
 * und läuft über `getPendingProjectInvitationsView` — dieselbe Trennung wie
 * `whereFor()` im Audit-Log zwischen Workspace- und Projekt-Feed.
 */
export const getPendingWorkspaceInvitationsView = cache(
  async (
    cursor?: string,
    limit: number = TABLE_PAGE_SIZE,
  ): Promise<PendingInvitationsView | null> => {
    const workspaceId = requireWorkspaceId();
    if (!(await currentUserCanEnterWorkspace(workspaceId))) return null;

    const actorId = await currentUserId();
    const access = await accessFor(actorId, { workspaceId });
    if (!access.has("member.invite")) return null;

    const now = new Date();
    const invitations = await db.invitation.findMany({
      where: { workspaceId, projectId: null, acceptedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor ? { cursor: { token: cursor }, skip: 1 } : {}),
      select: {
        token: true,
        createdAt: true,
        expires: true,
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            workspaces: {
              where: { workspaceId },
              select: { role: { select: { name: true } } },
            },
          },
        },
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    });

    const rows: PendingInvitationRow[] = invitations.map((inv) => ({
      token: inv.token,
      // Das Schatten-Konto einer Einladung entsteht immer mit der
      // eingeladenen Adresse (`inviteOneWorkspaceMember`) — anders als ein
      // Passkey-Erstkonto ist `email` hier nie leer. Der Fallback ist reine
      // Typsicherheit, kein erwarteter Fall.
      email: inv.user.email ?? "",
      firstName: inv.user.firstName,
      lastName: inv.user.lastName,
      roleName: inv.user.workspaces[0]?.role.name ?? "—",
      invitedByName: inv.invitedBy
        ? `${inv.invitedBy.firstName} ${inv.invitedBy.lastName}`.trim()
        : null,
      createdAt: inv.createdAt,
      expires: inv.expires,
      expired: inv.expires <= now,
    }));

    return {
      rows,
      canManage: access.has("member.invite"),
      nextCursor:
        invitations.length === limit
          ? invitations[invitations.length - 1].token
          : null,
    };
  },
);

/** Der teilbare Einladungslink des Workspace, samt der Rollen, die zur
 *  Neuerstellung zur Auswahl stehen. */
export const getWorkspaceInviteLinkView = cache(
  async (): Promise<InviteLinkView | null> => {
    const workspaceId = requireWorkspaceId();
    if (!(await currentUserCanEnterWorkspace(workspaceId))) return null;

    const actorId = await currentUserId();
    const access = await accessFor(actorId, { workspaceId });
    if (!access.has("member.invite")) return null;

    const ceiling = assignmentCeiling(access, "WORKSPACE");
    const now = new Date();

    const [roles, link] = await Promise.all([
      getRoles(workspaceId),
      db.inviteLink.findFirst({
        where: { workspaceId, projectId: null, revokedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          token: true,
          roleId: true,
          expiresAt: true,
          role: { select: { name: true } },
        },
      }),
    ]);

    const active =
      link && (!link.expiresAt || link.expiresAt > now)
        ? {
            token: link.token,
            url: inviteLinkUrl(link.token),
            roleId: link.roleId,
            roleName: link.role.name,
            expiresAt: link.expiresAt,
          }
        : null;

    return {
      activeLink: active,
      assignableRoles: roles.filter(
        (r) => r.id !== OWNER_ROLE_KEY && r.rank <= ceiling,
      ),
      canManage: true,
    };
  },
);
