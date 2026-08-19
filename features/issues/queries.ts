import { cache } from "react";
import { db } from "@/lib/db";
import { issueShareUrl } from "@/lib/issue-share";
import {
  accessFor,
  accessibleProjectIds,
  currentUserCanEnterWorkspace,
  currentUserId,
  hasPermission,
  visibleProjectIds,
} from "@/lib/permissions";
import { toDoc } from "@/lib/richtext/doc";
import type { PMDoc } from "@/lib/richtext/types";
import { resolveAvatarUrl } from "@/lib/storage";
import type {
  Issue,
  IssueAccess,
  IssueDetail,
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
  shareToken?: string | null;
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
    shareUrl: i.shareToken ? issueShareUrl(i.shareToken) : null,
  };
}

// ── Cached queries (deduplicated per request) ─────────────────────────────────
//
// Jede Abfrage prüft selbst — ein Layout schützt nur die Seiten unter sich, nicht
// jeden Aufruf einer Funktion (siehe docs/rbac.md, „Enforcement"). Zwei Prüfungen
// kommen hier vor:
//
//   `currentUserCanEnterWorkspace`  gehört die Person überhaupt in den Workspace?
//   `visibleProjectIds`             welche Projekte darf sie darin sehen?
//
// Beide fangen leer statt zu werfen: die Abfragen laufen in Server Components,
// die parallel zum Layout rendern — eine Ausnahme würde dort als 500 landen,
// bevor das `notFound()` des Layouts greift. Leere Daten führen dagegen über die
// bestehenden `if (!me) notFound()`-Pfade zum richtigen Ergebnis.

export const getWorkspace = cache(async (id: string) => {
  // Gesperrte Workspaces (vom Plattform-Admin suspendiert) sind für den normalen
  // App-Zugriff nicht auffindbar → die Layouts behandeln sie via notFound().
  const workspace = await db.workspace.findFirst({
    where: { id, suspended: false },
    select: { id: true, name: true, color: true, avatarKey: true },
  });
  if (!workspace) return null;

  const { avatarKey, ...rest } = workspace;
  return { ...rest, avatarUrl: await resolveAvatarUrl(avatarKey) };
});

export const getUserWorkspaces = cache(async (userId: string) => {
  const rows = await db.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        select: { id: true, name: true, color: true, avatarKey: true },
      },
    },
    orderBy: { workspace: { name: "asc" } },
  });
  return Promise.all(
    rows.map(async (r) => {
      const { avatarKey, ...rest } = r.workspace;
      return { ...rest, avatarUrl: await resolveAvatarUrl(avatarKey) };
    }),
  );
});

export const getProjects = cache(
  async (workspaceId: string): Promise<Project[]> => {
    // Die Projektliste ist die Navigation der ganzen App — was hier fehlt,
    // taucht auch in Sidebar, TabBar und Suche nicht auf. Deshalb ist sie der
    // Ort für die Sichtbarkeitsregel, und nicht jede Seite für sich.
    const visible = await visibleProjectIds(workspaceId);
    if (visible.size === 0) return [];

    const rows = await db.project.findMany({
      where: { workspaceId, id: { in: [...visible] } },
      orderBy: { name: "asc" },
    });
    return Promise.all(
      rows.map(async (p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        prefix: p.prefix,
        color: p.color,
        avatarUrl: await resolveAvatarUrl(p.avatarKey),
      })),
    );
  },
);

export const getMembers = cache(
  async (workspaceId: string): Promise<User[]> => {
    // Die Mitgliederliste trägt Namen und E-Mail-Adressen — sie gehört niemandem
    // von außen. `getMe()` liest sie ebenfalls, eine leere Liste führt dort
    // deshalb geradewegs zum `notFound()` der Seiten.
    if (!(await currentUserCanEnterWorkspace(workspaceId))) return [];

    const rows = await db.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true, role: { select: { key: true, rank: true } } },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    });
    return Promise.all(
      rows.map(async (m) => {
        const image =
          (await resolveAvatarUrl(m.user.avatarKey)) ?? m.user.image;
        return {
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
        };
      }),
    );
  },
);

export const getLabels = cache(
  async (workspaceId: string): Promise<Label[]> => {
    // Workspace-Labels gelten überall, Projekt-Labels nur dort — und ein Projekt,
    // das jemand nicht sehen darf, verrät auch seine Labels nicht.
    const visible = await visibleProjectIds(workspaceId);
    const rows = await db.label.findMany({
      where: {
        workspaceId,
        OR: [{ projectId: null }, { projectId: { in: [...visible] } }],
      },
      orderBy: { name: "asc" },
      // Wo ein Workspace-Label ausgeblendet ist, gehört zum Label — die Auswahl
      // an einem Issue kennt nur diese eine Liste und muss ihr ansehen können,
      // was in ihrem Projekt gilt.
      include: { hiddenIn: { select: { projectId: true } } },
    });
    return rows.map((l) => ({
      id: l.id,
      name: l.name,
      slug: l.slug,
      color: l.color,
      projectId: l.projectId ?? null,
      hiddenIn: l.hiddenIn.map((h) => h.projectId),
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
  // Wie die Mitgliederliste: ein Team nennt seine Mitglieder.
  if (!(await currentUserCanEnterWorkspace(workspaceId))) return [];

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

/**
 * Die Filter der Topbar, so wie sie in der URL stehen: kommagetrennte,
 * menschenlesbare Slugs. Board, Liste und „Meine Aufgaben“ tragen dieselben —
 * nur der Ausschnitt, in dem gesucht wird, unterscheidet sie.
 */
export interface IssueFilters {
  status?: string;
  priority?: string;
  assignee?: string;
  label?: string;
  /** Nur in projektübergreifenden Ansichten belegt (siehe `getMyIssues`). */
  project?: string;
  q?: string;
}

/**
 * Übersetzt die Slugs aus der URL in die internen Werte am Issue und baut daraus
 * die `where`-Bedingungen — einmal für alle Ansichten, damit derselbe Filter
 * überall dasselbe bedeutet.
 *
 * Die Projekte kommen getrennt zurück: der Aufrufer kennt seinen eigenen
 * Ausschnitt (ein Projekt, oder die sichtbaren eines Workspace) und muss den
 * Filter mit ihm schneiden, statt ihn zu überschreiben.
 *
 * Ein Slug, der nichts trifft, fällt weg — die Ansicht zeigt dann alles statt
 * nichts. Das ist die Regel für jeden dieser Filter, und ein veralteter Link
 * landet damit nicht auf einer leeren Seite.
 */
async function resolveIssueFilters(
  filters: IssueFilters,
  scope: { projectId: string } | { workspaceId: string },
): Promise<{
  where: Record<string, unknown>;
  /** `null`, wenn nicht nach Projekt gefiltert wird. */
  projectIds: string[] | null;
}> {
  const list = (value?: string) => value?.split(",").filter(Boolean) ?? [];

  // Status-Slug == Status-Id, der braucht kein Nachschlagen.
  const statuses = list(filters.status);
  const prioritySlugs = list(filters.priority);
  const assigneeSlugs = list(filters.assignee);
  const labelSlugs = list(filters.label);
  const projectSlugs = "workspaceId" in scope ? list(filters.project) : [];

  const [priorityRows, assigneeRows, labelRows, projectRows] =
    await Promise.all([
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
              ...("projectId" in scope
                ? { workspace: { projects: { some: { id: scope.projectId } } } }
                : { workspaceId: scope.workspaceId }),
            },
            select: { id: true },
          })
        : Promise.resolve([]),
      projectSlugs.length && "workspaceId" in scope
        ? db.project.findMany({
            where: {
              slug: { in: projectSlugs },
              workspaceId: scope.workspaceId,
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

  return {
    where: {
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
    projectIds: projectRows.length ? projectRows.map((p) => p.id) : null,
  };
}

export async function getIssuesByProject(
  projectId: string,
  filters: IssueFilters = {},
): Promise<IssueDetail[]> {
  // Die Issues sind der Inhalt des Projekts — ohne `project.view` gibt es sie
  // nicht. Das greift auch für `blocked`: die Rolle verbietet alles, also auch
  // das Lesen, und nicht nur das Schreiben.
  if (!(await hasPermission("project.view", { projectId }))) return [];

  const { where } = await resolveIssueFilters(filters, { projectId });

  const rows = await db.issue.findMany({
    // Der Ausschnitt steht hinter den Filtern: kein Slug in der URL kann ihn
    // überschreiben.
    where: { ...where, projectId },
    include: { comments: { orderBy: { created: "asc" } } },
    orderBy: [{ rank: "asc" }, { created: "asc" }],
  });
  // `issueAccessFor` löst je Projekt einmal auf und ist `cache()`d — bei allen
  // Zeilen desselben Projekts kostet das keine weitere Datenbankfrage. Board
  // und Liste zeigen sonst Titel, Status, Priorität und Zuständigkeit als
  // Bedienelemente, die der Server ohnehin ablehnen würde (`updateIssue`).
  return Promise.all(
    rows.map(async (i) => ({
      ...mapIssue(i),
      access: await issueAccessFor(i),
    })),
  );
}

// Auch die eigenen Issues bleiben an das Projekt gebunden: wer aus einem Projekt
// entfernt wird, sieht das Issue nicht weiter, nur weil sein Name darauf steht.
export async function getMyIssues(
  userId: string,
  workspaceId: string,
  filters: IssueFilters = {},
): Promise<IssueDetail[]> {
  const visible = await accessibleProjectIds(userId, workspaceId);
  if (visible.size === 0) return [];

  const { where, projectIds } = await resolveIssueFilters(filters, {
    workspaceId,
  });
  // Der Projektfilter schneidet in die sichtbaren Projekte hinein, nie über sie
  // hinaus: eine Projekt-Id in der URL öffnet nichts, was ohne sie zu wäre.
  const scoped = projectIds
    ? [...visible].filter((id) => projectIds.includes(id))
    : [...visible];
  if (scoped.length === 0) return [];

  const rows = await db.issue.findMany({
    // Zuständigkeit und Ausschnitt stehen hinter den Filtern — ein `?assignee=`
    // in der Adresse macht aus „meinen“ keine fremden Aufgaben.
    where: { ...where, assigneeId: userId, projectId: { in: scoped } },
    include: { comments: { orderBy: { created: "asc" } } },
    // Wie im Projekt: nach Rang, damit eine gezogene Zeile dort liegen bleibt,
    // wo sie fallen gelassen wurde.
    orderBy: [{ rank: "asc" }, { created: "asc" }],
  });
  // Über mehrere Projekte hinweg löst `issueAccessFor` je vorkommendem Projekt
  // einmal auf (`cache()`), nicht je Zeile.
  return Promise.all(
    rows.map(async (i) => ({
      ...mapIssue(i),
      access: await issueAccessFor(i),
    })),
  );
}

/**
 * Was der aktuelle Benutzer mit genau diesem Issue darf.
 *
 * Spiegelt `updateIssue`/`deleteIssue` (`features/issues/actions.ts`) Zeile
 * für Zeile — die Detailansicht (Titel, Beschreibung, Typ, Status, Priorität,
 * Zuständigkeit, Löschen) bietet damit nie eine Bedienung an, die der Server
 * ohnehin mit `PermissionError` ablehnen würde. `issue.update.own`/
 * `issue.delete.own` hängen an Eigentümerschaft, nicht nur an der Rolle —
 * deshalb hier und nicht in `mapIssue` (das kennt weder Benutzer noch Access).
 */
async function issueAccessFor(issue: {
  reporterId: string;
  assigneeId: string | null;
  projectId: string;
}): Promise<IssueAccess> {
  const userId = await currentUserId();
  if (!userId)
    return {
      canEdit: false,
      canAssign: false,
      canDelete: false,
      canShare: false,
    };

  const access = await accessFor(userId, { projectId: issue.projectId });
  const isOwner = userId === issue.reporterId || userId === issue.assigneeId;

  const canEdit =
    access.has("issue.update.any") ||
    (access.has("issue.update.own") && isOwner);
  const canDelete =
    access.has("issue.delete.any") ||
    (access.has("issue.delete.own") && isOwner);

  return {
    canEdit,
    canAssign: canEdit && access.has("issue.assign"),
    canDelete,
    canShare: access.has("issue.share.manage"),
  };
}

export async function getIssueById(id: string): Promise<IssueDetail | null> {
  const i = await db.issue.findUnique({
    where: { id },
    include: { comments: { orderBy: { created: "asc" } } },
  });
  if (!i) return null;
  // Ein einzelnes Issue über seine Id — der direkteste Weg an fremde Inhalte,
  // wenn hier nichts steht. `null` statt einer Ausnahme: die Aufrufer machen
  // daraus ein 404, und ein 404 verrät nicht, dass es das Issue gibt.
  if (!(await hasPermission("project.view", { projectId: i.projectId })))
    return null;
  const access = await issueAccessFor(i);
  return { ...mapIssue(i), access };
}

/**
 * Löst eine Referenz der Form „PREFIX-123“ innerhalb eines Workspace auf.
 *
 * Über `cache()`, weil die Detailseite sie zweimal im selben Request braucht:
 * einmal für `generateMetadata` (Tab-Titel) und einmal für die Seite selbst.
 */
export const getIssueByRef = cache(
  async (
    workspaceId: string,
    issueRef: string,
  ): Promise<IssueDetail | null> => {
    const match = issueRef.match(/^([A-Z0-9]+)-(\d+)$/i);
    if (!match) return null;
    const prefix = match[1].toUpperCase();
    const key = parseInt(match[2], 10);

    const project = await db.project.findFirst({
      where: { workspaceId, prefix },
    });
    if (!project) return null;
    if (!(await hasPermission("project.view", { projectId: project.id })))
      return null;

    const i = await db.issue.findUnique({
      where: { projectId_key: { projectId: project.id, key } },
      include: { comments: { orderBy: { created: "asc" } } },
    });
    if (!i) return null;
    const access = await issueAccessFor(i);
    return { ...mapIssue(i), access };
  },
);

/** Eine minimale, absichtlich unvollständige Projektion für die öffentliche
 *  Issue-Seite — kein `access`, keine internen Ids in der Antwort außer
 *  denen, die die Anzeige selbst braucht. Die Seite darf strukturell keine
 *  Bearbeitungs-UI rendern können. */
/** Reicht für `components/ui/atoms/Avatar` (`PersonAvatarData`) — hier lokal
 *  definiert statt von dort importiert, damit diese Abfrage keine
 *  UI-Abhängigkeit bekommt. */
interface PublicPerson {
  firstName: string;
  lastName: string;
  color: string;
  image?: string;
}

async function toPerson<
  T extends {
    firstName: string;
    lastName: string;
    color: string;
    image: string | null;
    avatarKey: string | null;
  },
>(u: T): Promise<PublicPerson> {
  return {
    firstName: u.firstName,
    lastName: u.lastName,
    color: u.color,
    image: (await resolveAvatarUrl(u.avatarKey)) ?? u.image ?? undefined,
  };
}

export interface PublicSharedIssue {
  identifier: string;
  /** Für den Weg zurück in die App, wenn die betrachtende Person bereits
   *  Zugriff hat (`SharedIssuePage`, Redirect via `getIssueByRef`). */
  workspaceId: string;
  title: string;
  description: PMDoc;
  status: { name: string; color: string } | null;
  priority: { name: string; color: string } | null;
  type: { name: string; color: string } | null;
  labels: { id: string; name: string; color: string }[];
  projectName: string;
  workspaceName: string;
  assignee: PublicPerson | null;
  reporter: PublicPerson;
  /** Wer den Link erzeugt hat — `null`, wenn das Konto seither weg ist
   *  (`onDelete: SetNull`). */
  sharedBy: PublicPerson | null;
  sharedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  comments: {
    id: string;
    body: PMDoc;
    author: PublicPerson;
    created: Date;
  }[];
}

/**
 * Löst einen öffentlichen Issue-Link auf. `null` heißt in jedem Fall
 * dasselbe: unbekannter, deaktivierter, abgelaufener oder nie aktivierter
 * Token — dieselbe Zurückhaltung wie `openInvitation`/`resolveInviteLink`.
 */
export async function getIssueByShareToken(
  token: string,
  now: Date = new Date(),
): Promise<PublicSharedIssue | null> {
  if (!token) return null;

  const personSelect = {
    firstName: true,
    lastName: true,
    color: true,
    image: true,
    avatarKey: true,
  } as const;

  const issue = await db.issue.findUnique({
    where: { shareToken: token },
    select: {
      key: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      type: true,
      labels: true,
      created: true,
      updated: true,
      shareTokenCreatedAt: true,
      shareTokenExpiresAt: true,
      assignee: { select: personSelect },
      reporter: { select: personSelect },
      sharedBy: { select: personSelect },
      project: {
        select: {
          name: true,
          prefix: true,
          workspaceId: true,
          workspace: { select: { name: true } },
        },
      },
      comments: {
        orderBy: { created: "asc" },
        select: {
          id: true,
          body: true,
          created: true,
          author: { select: personSelect },
        },
      },
    },
  });
  if (!issue) return null;
  if (issue.shareTokenExpiresAt && issue.shareTokenExpiresAt <= now)
    return null;

  const [statuses, priorities, types, labelRows] = await Promise.all([
    getStatuses(issue.project.workspaceId),
    getPriorities(issue.project.workspaceId),
    getIssueTypes(issue.project.workspaceId),
    issue.labels.length > 0
      ? db.label.findMany({
          where: { id: { in: issue.labels } },
          select: { id: true, name: true, color: true },
        })
      : Promise.resolve([]),
  ]);

  const status = statuses.find((s) => s.id === issue.status) ?? null;
  const priority = priorities.find((p) => p.id === issue.priority) ?? null;
  const type = types.find((t) => t.id === issue.type) ?? null;

  return {
    identifier: `${issue.project.prefix}-${issue.key}`,
    workspaceId: issue.project.workspaceId,
    title: issue.title,
    description: toDoc(issue.description),
    status: status ? { name: status.name, color: status.color } : null,
    priority: priority ? { name: priority.name, color: priority.color } : null,
    type: type ? { name: type.name, color: type.color } : null,
    labels: labelRows,
    projectName: issue.project.name,
    workspaceName: issue.project.workspace.name,
    assignee: issue.assignee ? await toPerson(issue.assignee) : null,
    reporter: await toPerson(issue.reporter),
    sharedBy: issue.sharedBy ? await toPerson(issue.sharedBy) : null,
    sharedAt: issue.shareTokenCreatedAt,
    expiresAt: issue.shareTokenExpiresAt,
    createdAt: issue.created,
    updatedAt: issue.updated,
    comments: await Promise.all(
      issue.comments.map(async (c) => ({
        id: c.id,
        body: toDoc(c.body),
        author: await toPerson(c.author),
        created: c.created,
      })),
    ),
  };
}

export const getSearchIssues = cache(
  async (workspaceId: string): Promise<SearchableIssue[]> => {
    // Die Suche greift über alle Projekte des Workspace — genau deshalb muss die
    // Sichtbarkeit hier stehen und nicht erst in der Anzeige.
    const visible = await visibleProjectIds(workspaceId);
    if (visible.size === 0) return [];

    const rows = await db.issue.findMany({
      where: { projectId: { in: [...visible] } },
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
