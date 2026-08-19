import { cache } from "react";
import type {
  ProjectLabelRow,
  ProjectLabelsView,
  ProjectMemberRow,
  ProjectMembersView,
  ProjectSettingsView,
} from "@/features/projects/types";
// Dieselbe Form wie auf Workspace-Ebene — geteilt statt dupliziert, die
// Übersichts-Tabelle (`PendingInvitations`) kennt ohnehin nur die Zeile, kein
// Workspace oder Projekt.
import type {
  InviteLinkView,
  PendingInvitationRow,
  PendingInvitationsView,
} from "@/features/workspaces/types";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { inviteLinkUrl } from "@/lib/invite-links";
import { TABLE_PAGE_SIZE } from "@/lib/pagination";
import {
  accessFor,
  assignmentCeiling,
  currentUserId,
  visibleProjectIds,
} from "@/lib/permissions";
import { DEFAULT_PROJECT_ROLE_KEY, PROJECT_ADMIN_ROLE_KEY } from "@/lib/rbac";
import type { Role, User } from "@/types";

// ── Übersicht ─────────────────────────────────────────────────────────────────

/** Ein Projekt, wie die Übersichtsseite es zeigt: wer, was, wofür. */
export interface ProjectOverviewRow {
  id: string;
  name: string;
  slug: string;
  prefix: string;
  color: string;
  /** Leer, wenn niemand einen Satz dazu geschrieben hat. */
  desc: string;
  /**
   * Wer das Projekt leitet — die erste Person mit der Projektrolle
   * „Project Admin". `null`, wenn es keine gibt.
   */
  lead: User | null;
  /** Weitere Leitende neben `lead`; die Spalte zeigt sie als „+n". */
  moreLeads: number;
}

export interface ProjectOverviewView {
  rows: ProjectOverviewRow[];
  /** `project.create` — ob der Knopf im Seitenkopf erscheint. */
  canCreate: boolean;
  /** Id des letzten Projekts dieser Seite, für `loadMoreProjectsOverview` —
   * `null`, wenn `rows` schon alles ist. */
  nextCursor: string | null;
}

/**
 * Die Projekte, die der Handelnde sehen darf — zum Nachschlagen, nicht zum
 * Verwalten.
 *
 * Bewusst eine andere Ansicht als `getWorkspaceProjectsView` in den
 * Einstellungen: die trennt nach Sichtbarkeit und zählt Mitglieder und
 * Aufgaben, weil dort verwaltet wird. Hier steht in einer einzigen Liste, was
 * jemand sucht, der ein Projekt betreten will — Name, wofür es da ist, wer es
 * leitet, unter welchem Kürzel seine Aufgaben laufen. Ob es privat ist, hat die
 * Sichtbarkeitsregel schon beantwortet: was hier steht, darf man sehen.
 */
export const getProjectsOverview = cache(
  async (
    workspaceId: string,
    cursor?: string,
    limit: number = TABLE_PAGE_SIZE,
  ): Promise<ProjectOverviewView> => {
    const userId = await currentUserId();
    const access = await accessFor(userId, { workspaceId });
    const canCreate = access.has("project.create");

    // Dieselbe Sichtbarkeitsregel wie überall — die Übersicht ist nur eine
    // andere Darstellung der Liste aus `getProjects`.
    const visible = await visibleProjectIds(workspaceId);
    if (visible.size === 0) return { rows: [], canCreate, nextCursor: null };

    const projects = await db.project.findMany({
      where: { workspaceId, id: { in: [...visible] } },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        slug: true,
        prefix: true,
        color: true,
        desc: true,
        // Die Leitung des Projekts. Ein paar mehr als die eine gezeigte, damit
        // „+n" stimmt; wer ein Projekt mit mehr als sechs Leitenden hat, hat
        // eine andere Frage als diese Spalte.
        members: {
          where: { role: { key: PROJECT_ADMIN_ROLE_KEY } },
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
          take: 6,
        },
      },
      orderBy: { name: "asc" },
    });

    const rows: ProjectOverviewRow[] = projects.map((project) => {
      const leads = project.members.map((m) => ({
        ...m.user,
        image: m.user.image ?? undefined,
      }));
      return {
        id: project.id,
        name: project.name,
        slug: project.slug,
        prefix: project.prefix,
        color: project.color,
        desc: project.desc,
        lead: leads[0] ?? null,
        moreLeads: Math.max(0, leads.length - 1),
      };
    });

    return {
      rows,
      canCreate,
      nextCursor:
        projects.length === limit ? projects[projects.length - 1].id : null,
    };
  },
);

// ── Einstellungen ─────────────────────────────────────────────────────────────

/**
 * Das Projekt, wie seine Einstellungsseite es braucht — samt der Frage, was der
 * Handelnde damit darf.
 *
 * `null` heißt „gibt es für dich nicht": entweder existiert das Projekt nicht,
 * oder es ist nicht sichtbar. Die Seite macht daraus ein 404, und damit verrät
 * sie nicht, welcher der beiden Fälle vorliegt.
 */
export const getProjectSettingsView = cache(
  async (projectId: string): Promise<ProjectSettingsView | null> => {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        slug: true,
        prefix: true,
        color: true,
        desc: true,
        visibility: true,
        _count: { select: { issues: true, members: true } },
      },
    });
    if (!project) return null;

    const access = await accessFor(await currentUserId(), { projectId });
    if (!access.has("project.view")) return null;

    return {
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        prefix: project.prefix,
        color: project.color,
        desc: project.desc,
        visibility: project.visibility,
        issueCount: project._count.issues,
        memberCount: project._count.members,
      },
      canUpdate: access.has("project.update"),
      canDelete: access.has("project.delete"),
    };
  },
);

// ── Mitglieder ────────────────────────────────────────────────────────────────

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  color: string;
  image: string | null;
};

function toUser(u: UserRow, pending: boolean): User {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    color: u.color,
    ...(u.image ? { image: u.image } : {}),
    pending,
  };
}

const byName = [
  { user: { firstName: "asc" as const } },
  { user: { lastName: "asc" as const } },
];

/**
 * Wer Zugriff auf ein Projekt hat — und woher dieser Zugriff kommt.
 *
 * Die Liste ist `ProjectMember`: jede Zeile eine Person mit ihrer Projektrolle,
 * und die entscheidet hier (`lib/permissions.ts`). Dazu kommen nur die, die sich
 * per Projektrolle gar nicht herabstufen lassen — Owner und Admins des Workspace
 * sehen jedes Projekt, auch ohne Eintrag darin. Sie stehen mit ihrer
 * Workspace-Rolle in der Liste (`source: "workspace"`).
 *
 * Die Seite bekommt fertige Zeilen inklusive `manageable` — welche Rolle wen
 * anfassen darf, entscheidet der Server, nicht der Client.
 */
const memberRoleSelect = {
  select: { id: true, key: true, name: true, rank: true },
} as const satisfies Prisma.RoleDefaultArgs;

export const getProjectMembersView = cache(
  async (
    projectId: string,
    cursor?: string,
    limit: number = TABLE_PAGE_SIZE,
  ): Promise<ProjectMembersView | null> => {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    if (!project) return null;
    const { workspaceId } = project;

    const actorId = await currentUserId();
    const access = await accessFor(actorId, { projectId });

    // Die Liste nennt Namen und E-Mail-Adressen. Wer das Projekt nicht sehen
    // darf, bekommt dasselbe wie bei einem Projekt, das es nicht gibt — die
    // Seite macht daraus ein 404.
    if (!access.has("project.view")) return null;

    const [projectMembers, workspaceMembers, projectRoles, viewAllRoles] =
      await Promise.all([
        db.projectMember.findMany({
          where: { projectId },
          include: {
            user: true,
            role: memberRoleSelect,
            originTeam: { select: { id: true, name: true, color: true } },
          },
          orderBy: byName,
        }),
        db.workspaceMember.findMany({
          where: { workspaceId },
          include: { user: true, role: memberRoleSelect },
          orderBy: byName,
        }),
        // Zuweisbar sind die Projektrollen des Workspace plus die
        // projektlokalen Rollen genau dieses Projekts.
        db.role.findMany({
          where: {
            scope: "PROJECT",
            OR: [
              { system: true },
              { workspaceId, projectId: null },
              { projectId },
            ],
          },
          orderBy: { rank: "desc" },
        }),
        // Welche Workspace-Rollen ihre Träger in jedem Projekt durchgreifen
        // lassen. Ersetzt die frühere Abfrage auf die Namen "owner" und "admin".
        db.role.findMany({
          where: {
            scope: "WORKSPACE",
            OR: [{ system: true }, { workspaceId }],
            permissions: { some: { permissionKey: "project.admin.all" } },
          },
          select: { id: true },
        }),
      ]);

    // Drei Rechte, drei Bedeutungen — die Oberfläche zeigt genau das, was die
    // dazugehörige Action auch durchlässt (`requireMemberManage`).
    const canAdd = access.has("member.invite");
    const canSetRole = access.has("member.role.update");
    const canRemove = access.has("member.remove");
    const anyManage = canAdd || canSetRole || canRemove;
    const actorRank = anyManage
      ? assignmentCeiling(access, "PROJECT")
      : Number.NEGATIVE_INFINITY;

    const viewAll = new Set(viewAllRoles.map((r) => r.id));
    // Wer über seine Workspace-Rolle in jedem Projekt durchgreift, lässt sich
    // per Projektrolle nicht herabstufen — der Resolver entscheidet für ihn
    // schon vor der Projektrolle (Regel 3 in lib/permissions.ts).
    const privileged = new Set(
      workspaceMembers
        .filter((m) => viewAll.has(m.roleId))
        .map((m) => m.userId),
    );
    const pendingOf = new Map(
      workspaceMembers.map((m) => [m.userId, m.pending]),
    );

    const rows: ProjectMemberRow[] = projectMembers.map((pm) => ({
      user: toUser(pm.user, pendingOf.get(pm.userId) ?? false),
      role: pm.role.key,
      roleName: pm.role.name,
      roleRank: pm.role.rank,
      source: "project",
      origin: pm.origin,
      originTeam: pm.originTeam ?? undefined,
      pending: pendingOf.get(pm.userId) ?? false,
      you: pm.userId === actorId,
      // Niemand ändert ein Mitglied, das über ihm steht — und die eigene Rolle
      // schon gar nicht über diese Tabelle. Die Leitung des Workspace bleibt
      // außen vor: an ihren Rechten würde die Änderung nichts ändern.
      //
      // Das sagt nur, dass die Zeile anfassbar ist. Welche der drei Aktionen
      // erlaubt ist, sagen `canSetRole` und `canRemove`.
      manageable:
        anyManage &&
        pm.userId !== actorId &&
        !privileged.has(pm.userId) &&
        pm.role.rank <= actorRank,
    }));

    const hasOwnEntry = new Set(projectMembers.map((pm) => pm.userId));
    const candidates: User[] = [];

    for (const wm of workspaceMembers) {
      if (hasOwnEntry.has(wm.userId)) continue;

      const user = toUser(wm.user, wm.pending);
      // Wer ohnehin in jedem Projekt alles darf, braucht keinen Projekt-Eintrag
      // — der wäre nur eine leere Geste.
      const isPrivileged = privileged.has(wm.userId);
      if (!isPrivileged) candidates.push(user);

      if (wm.pending) continue;
      // Ohne Projektrolle gibt es keinen Zugriff — außer für die, die den
      // Generalschlüssel tragen. Nur sie stehen hier ohne eigenen Eintrag.
      if (!isPrivileged) continue;

      rows.push({
        user,
        role: wm.role.key,
        roleName: wm.role.name,
        roleRank: wm.role.rank,
        source: "workspace",
        pending: false,
        you: wm.userId === actorId,
        // Hier steht nur, wer ohnehin in jedem Projekt alles darf — an dieser
        // Zeile gibt es nichts zu verwalten. Ein Projekt-Eintrag würde ihre
        // Rechte nicht ändern, ein Entzug erst recht nicht.
        manageable: false,
      });
    }

    const assignableRoles: Role[] =
      canSetRole || canAdd
        ? projectRoles
            .filter((r) => r.rank <= actorRank)
            .map((r) => ({
              id: r.key,
              name: r.name,
              desc: r.desc,
              rank: r.rank,
            }))
        : [];
    const defaultRole =
      assignableRoles.find((r) => r.id === DEFAULT_PROJECT_ROLE_KEY)?.id ??
      assignableRoles.at(-1)?.id ??
      "";

    // Kein DB-Cursor: `rows` entsteht aus zwei vollständig gelesenen Quellen
    // im Speicher (oben), nicht aus einer Abfrage mit eigenem `take`/`cursor`.
    // Die Seite selbst bleibt trotzdem billig — bei „ein paar Dutzend
    // Mitgliedern" kostet das erneute Zusammensetzen beim Nachladen nichts,
    // was eine echte DB-Pagination hier rechtfertigen würde.
    const offset = cursor ? Number.parseInt(cursor, 10) : 0;
    const page = rows.slice(offset, offset + limit);

    return {
      rows: page,
      candidates: canAdd ? candidates : [],
      assignableRoles,
      defaultRole,
      canAdd,
      canSetRole,
      canRemove,
      canInvite: canAdd,
      nextCursor: offset + limit < rows.length ? String(offset + limit) : null,
    };
  },
);

/**
 * Offene Einladungen eines Projekts — nur die projektgebundenen (Gäste ohne
 * Workspace-Mitgliedschaft eingeschlossen). Das Workspace-Äquivalent
 * (`getPendingWorkspaceInvitationsView`) filtert `projectId: null` und lässt
 * diese hier bewusst aus — dieselbe Trennung wie beim Audit-Log.
 */
export const getPendingProjectInvitationsView = cache(
  async (
    projectId: string,
    cursor?: string,
    limit: number = TABLE_PAGE_SIZE,
  ): Promise<PendingInvitationsView | null> => {
    const access = await accessFor(await currentUserId(), { projectId });
    if (!access.has("member.invite")) return null;

    const now = new Date();
    const invitations = await db.invitation.findMany({
      where: { projectId, acceptedAt: null },
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
            projectMemberships: {
              where: { projectId },
              select: { role: { select: { name: true } } },
            },
          },
        },
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    });

    const rows: PendingInvitationRow[] = invitations.map((inv) => ({
      token: inv.token,
      // Siehe workspaces/queries.ts: das Schatten-Konto einer Einladung hat
      // immer die eingeladene Adresse, der Fallback ist reine Typsicherheit.
      email: inv.user.email ?? "",
      firstName: inv.user.firstName,
      lastName: inv.user.lastName,
      roleName: inv.user.projectMemberships[0]?.role.name ?? "—",
      invitedByName: inv.invitedBy
        ? `${inv.invitedBy.firstName} ${inv.invitedBy.lastName}`.trim()
        : null,
      createdAt: inv.createdAt,
      expires: inv.expires,
      expired: inv.expires <= now,
    }));

    return {
      rows,
      canManage: true,
      nextCursor:
        invitations.length === limit
          ? invitations[invitations.length - 1].token
          : null,
    };
  },
);

/** Der teilbare Einladungslink eines Projekts, samt der Rollen, die zur
 *  Neuerstellung zur Auswahl stehen. Projekt-Äquivalent zu
 *  `getWorkspaceInviteLinkView`. */
export const getProjectInviteLinkView = cache(
  async (projectId: string): Promise<InviteLinkView | null> => {
    const access = await accessFor(await currentUserId(), { projectId });
    if (!access.has("member.invite")) return null;

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    if (!project) return null;

    const actorRank = assignmentCeiling(access, "PROJECT");
    const now = new Date();

    const [roles, link] = await Promise.all([
      db.role.findMany({
        where: {
          scope: "PROJECT",
          OR: [
            { system: true },
            { workspaceId: project.workspaceId, projectId: null },
            { projectId },
          ],
        },
        orderBy: { rank: "desc" },
      }),
      db.inviteLink.findFirst({
        where: { projectId, revokedAt: null },
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
      assignableRoles: roles
        .filter((r) => r.rank <= actorRank)
        .map((r) => ({ id: r.key, name: r.name, desc: r.desc, rank: r.rank })),
      canManage: true,
    };
  },
);

// ── Labels ────────────────────────────────────────────────────────────────────

/**
 * Die Labels, die in einem Projekt gelten — getrennt nach denen, die ihm
 * gehören, und denen, die es vom Workspace erbt.
 *
 * Die Trennung ist keine Kosmetik: die drei `label.*`-Rechte werden hier im
 * Projekt-Scope aufgelöst und reichen deshalb nur für die eigenen. Ein
 * Workspace-Label steht mit in der Liste, weil es an jedem Issue dieses
 * Projekts auftauchen kann — anfassen lässt es sich nur dort, wo es hingehört.
 */
export const getProjectLabelsView = cache(
  async (
    projectId: string,
    ownCursor?: string,
    inheritedCursor?: string,
    limit: number = TABLE_PAGE_SIZE,
  ): Promise<ProjectLabelsView | null> => {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    if (!project) return null;

    const access = await accessFor(await currentUserId(), { projectId });
    if (!access.has("project.view")) return null;

    const [ownLabels, inheritedLabels, tagged, hidden] = await Promise.all([
      db.label.findMany({
        where: { workspaceId: project.workspaceId, projectId },
        orderBy: { name: "asc" },
        take: limit,
        ...(ownCursor ? { cursor: { id: ownCursor }, skip: 1 } : {}),
      }),
      db.label.findMany({
        where: { workspaceId: project.workspaceId, projectId: null },
        orderBy: { name: "asc" },
        take: limit,
        ...(inheritedCursor
          ? { cursor: { id: inheritedCursor }, skip: 1 }
          : {}),
      }),
      // `Issue.labels` ist ein ID-Array ohne Fremdschlüssel — zählen lässt es
      // sich nur, indem man die Arrays dieses Projekts einmal durchgeht. Es
      // wird bewusst nur diese eine Spalte geladen.
      db.issue.findMany({ where: { projectId }, select: { labels: true } }),
      db.projectHiddenLabel.findMany({
        where: { projectId },
        select: { labelId: true },
      }),
    ]);

    const used = new Map<string, number>();
    for (const issue of tagged) {
      for (const id of issue.labels) used.set(id, (used.get(id) ?? 0) + 1);
    }

    const hiddenIds = new Set(hidden.map((h) => h.labelId));

    const toRow = (l: (typeof ownLabels)[number]): ProjectLabelRow => ({
      id: l.id,
      name: l.name,
      slug: l.slug,
      color: l.color,
      issueCount: used.get(l.id) ?? 0,
      hidden: hiddenIds.has(l.id),
    });

    return {
      own: ownLabels.map(toRow),
      inherited: inheritedLabels.map(toRow),
      canCreate: access.has("label.create"),
      canUpdate: access.has("label.update"),
      canDelete: access.has("label.delete"),
      ownNextCursor:
        ownLabels.length === limit ? ownLabels[ownLabels.length - 1].id : null,
      inheritedNextCursor:
        inheritedLabels.length === limit
          ? inheritedLabels[inheritedLabels.length - 1].id
          : null,
    };
  },
);
