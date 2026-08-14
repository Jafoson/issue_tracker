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
import {
  accessFor,
  currentUserCanEnterWorkspace,
  currentUserId,
  visibleProjectIds,
} from "@/lib/permissions";
import { OWNER_ROLE_KEY } from "@/lib/rbac";
import { getSession } from "@/lib/session";
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
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    handle: user.handle,
    email: user.email,
    color: user.color,
    ...(user.image ? { image: user.image } : {}),
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
        _count: { select: { projects: true, members: true } },
        links: {
          select: { id: true, label: true, url: true },
          orderBy: { position: "asc" },
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
        projectCount: workspace._count.projects,
        memberCount: workspace._count.members,
        issueCount,
        links: workspace.links,
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
export const getWorkspaceProjectsView = cache(
  async (): Promise<WorkspaceProjectsView | null> => {
    const workspaceId = requireWorkspaceId();
    if (!(await currentUserCanEnterWorkspace(workspaceId))) return null;

    const userId = await currentUserId();
    const visible = await visibleProjectIds(workspaceId);

    const projects = await db.project.findMany({
      where: { workspaceId, id: { in: [...visible] } },
      select: {
        id: true,
        name: true,
        slug: true,
        prefix: true,
        color: true,
        desc: true,
        visibility: true,
        _count: { select: { issues: true, members: true } },
        // Nur die ersten vier: mehr zeigt der Avatar-Stapel ohnehin nicht, und
        // die Gesamtzahl steht daneben (`_count.members`).
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
              },
            },
          },
          orderBy: [
            { user: { firstName: "asc" } },
            { user: { lastName: "asc" } },
          ],
          take: 4,
        },
      },
      orderBy: { name: "asc" },
    });

    const rows: WorkspaceProjectRow[] = await Promise.all(
      projects.map(async (project): Promise<WorkspaceProjectRow> => {
        const access = await accessFor(userId, { projectId: project.id });
        return {
          id: project.id,
          name: project.name,
          slug: project.slug,
          prefix: project.prefix,
          color: project.color,
          desc: project.desc,
          visibility: project.visibility as ProjectVisibility,
          issueCount: project._count.issues,
          memberCount: project._count.members,
          members: project.members.map((m) => ({
            ...m.user,
            image: m.user.image ?? undefined,
          })),
          canUpdate: access.has("project.update"),
          canDelete: access.has("project.delete"),
        };
      }),
    );

    const access = await accessFor(userId, { workspaceId });
    return {
      rows,
      canCreate: access.has("project.create"),
      // Dieselben Generalschlüssel, die `accessibleProjectIds` alle Projekte
      // aufschließen — nur hier im Workspace-Scope gefragt, wo Support ohnehin
      // jedes Recht trägt. Wer sie hat, hat oben die vollständige Liste bekommen
      // und darf sie deshalb nach Sichtbarkeit trennen.
      seesAllProjects:
        access.has("project.view.all") || access.has("project.admin.all"),
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
  async (): Promise<WorkspaceLabelsView | null> => {
    const workspaceId = requireWorkspaceId();
    if (!(await currentUserCanEnterWorkspace(workspaceId))) return null;

    const [labels, tagged, hidden] = await Promise.all([
      db.label.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          project: { select: { name: true, slug: true } },
        },
        orderBy: { name: "asc" },
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

    const toRow = (l: (typeof labels)[number]): WorkspaceLabelRow => ({
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
      own: labels.filter((l) => !l.project).map(toRow),
      fromProjects: labels.filter((l) => l.project).map(toRow),
      canCreate: access.has("label.create"),
      canUpdate: access.has("label.update"),
      canDelete: access.has("label.delete"),
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
  async (): Promise<WorkspaceTeamsView | null> => {
    const workspaceId = requireWorkspaceId();
    if (!(await currentUserCanEnterWorkspace(workspaceId))) return null;

    const [teams, members, projects, assignableProjectRoles] =
      await Promise.all([
        db.team.findMany({
          where: { workspaceId },
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

    const rows: WorkspaceTeamRow[] = teams.map((team) => {
      const teamProjects: TeamProjectRow[] = team.projects
        .map((p) => {
          const project = projectById.get(p.projectId);
          if (!project) return undefined;
          return { ...project, role: p.role };
        })
        .filter((p) => p !== undefined);

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
          ...(team.lead.image ? { image: team.lead.image } : {}),
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
    });

    const access = await accessFor(await currentUserId(), { workspaceId });

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
  async (): Promise<WorkspaceMembersView | null> => {
    const workspaceId = requireWorkspaceId();
    if (!(await currentUserCanEnterWorkspace(workspaceId))) return null;

    const actorId = await currentUserId();
    const [rowsRaw, teams, roles, access] = await Promise.all([
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
      accessFor(actorId, { workspaceId }),
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

    const rows: WorkspaceMemberRow[] = rowsRaw.map((m) => ({
      user: {
        id: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        handle: m.user.handle,
        email: m.user.email,
        color: m.user.color,
        ...(m.user.image ? { image: m.user.image } : {}),
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
    }));

    const assignableRoles =
      canSetRole || canInvite
        ? roles.filter((r) => r.id !== OWNER_ROLE_KEY && r.rank <= actorRank)
        : [];

    return { rows, assignableRoles, canInvite, canSetRole, canRemove };
  },
);
