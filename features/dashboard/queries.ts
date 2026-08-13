import "server-only";
import { cache } from "react";
import type {
  AttentionIssue,
  AttentionReason,
  DashboardStats,
  PrioritySlice,
  ProjectDashboardData,
  ProjectDashboardView,
  ProjectProfile,
  ProjectRoleGroup,
  StatusSlice,
  ThroughputPoint,
  WorkloadRow,
} from "@/features/dashboard/types";
import { resolveLayout } from "@/features/dashboard/widgets";
import { getPriorities, getStatuses } from "@/features/issues/queries";
import {
  type BucketUnit,
  bucketKey,
  type RangeKey,
  windowFor,
} from "@/lib/buckets";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { accessFor, currentUserId, hasPermission } from "@/lib/permissions";
import {
  DEFAULT_PROJECT_ROLE_KEY,
  PROJECT_BLOCKED_ROLE_KEY,
  PROJECT_GUEST_ROLE_KEY,
  PROJECT_VIEWER_ROLE_KEY,
  systemRolesIn,
} from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { CLOSED_STATUSES } from "@/lib/workspace-defaults";
import type { User } from "@/types";

// ─── Das Dashboard eines Projekts ────────────────────────────────────────────
//
// Gezählt wird in der Datenbank, nicht im Speicher. Der naheliegende Weg — alle
// Aufgaben des Projekts laden und in JavaScript gruppieren — überträgt bei einem
// gewachsenen Projekt Tausende Zeilen samt ihrer Beschreibungen, um am Ende ein
// Dutzend Zahlen zu zeigen. Die einzigen Abfragen, die ganze Zeilen holen, sind
// die beiden Listen unten, und die haben ein `take`.
//
// Die Zeitachse dagegen entsteht im Code (`lib/buckets.ts`): eine Gruppierung
// kennt nur Töpfe, in denen etwas liegt, und eine ruhige Woche wäre sonst keine
// Null, sondern ein Loch im Diagramm.
//
// **Rechte.** Alles hier hängt an `project.view` — die Zahlen sind der Inhalt des
// Projekts, in verdichteter Form. Wer die Aufgaben nicht sehen darf, darf auch
// nicht wissen, wie viele es sind. Wie überall gibt `null` zurück, was es „für
// dich nicht gibt"; die Seite macht daraus ein 404, ohne zu verraten, ob das
// Projekt fehlt oder der Zutritt.

const CLOSED = [...CLOSED_STATUSES];

/** Ab wann eine Aufgabe in Arbeit als liegengeblieben gilt. */
const STALE_DAYS = 14;

/** Wie viele Zeilen die beiden Listen unten höchstens zeigen. */
const LIST_LIMIT = 6;

/**
 * Der Rang der Mitarbeit — die untere Schwelle, ab der eine Rolle im Steckbrief
 * einzeln genannt wird (siehe `groupByRole`).
 *
 * Aus der Registry geholt statt als Zahl hingeschrieben: die Ränge stehen in
 * `lib/rbac/roles.ts`, und eine zweite Kopie davon hier wäre genau die Sorte
 * Zahl, die beim Umsortieren der Rollen still falsch wird.
 */
const CONTRIBUTOR_RANK =
  systemRolesIn("PROJECT").find((role) => role.key === DEFAULT_PROJECT_ROLE_KEY)
    ?.rank ?? 3;

/**
 * Die System-Rollen, die „arbeitet mit" oder „liest mit" bedeuten. Sie stehen im
 * Steckbrief als Liste, nicht als einzeln genannte Personen.
 *
 * Warum eine Liste von Schlüsseln und nicht bloß eine Rang-Grenze: die Ränge
 * sind ganze Zahlen, und zwischen `contributor` (3) und `project_admin` (4) ist
 * kein Platz. Eine projekteigene Rolle „Moderator" bekäme deshalb in der Praxis
 * ebenfalls die 3 — über den Rang allein wäre sie von der Mitarbeit nicht zu
 * unterscheiden und verschwände in deren Liste, obwohl sie genau das ist, was
 * man auf einer Übersicht namentlich sehen will.
 *
 * Die Schlüssel kommen als Konstanten aus der Registry: eine Umbenennung dort
 * bricht hier den Typecheck, statt still eine Gruppe umzusortieren.
 */
const ROSTER_ROLE_KEYS = new Set<string>([
  DEFAULT_PROJECT_ROLE_KEY,
  PROJECT_VIEWER_ROLE_KEY,
  PROJECT_GUEST_ROLE_KEY,
  PROJECT_BLOCKED_ROLE_KEY,
]);

function mapUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  color: string;
  image: string | null;
}): User {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    color: user.color,
    ...(user.image ? { image: user.image } : {}),
  };
}

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  color: true,
  image: true,
} as const;

/** Personenlisten stehen alphabetisch — wie überall in dieser Anwendung. */
const byName = [
  { user: { firstName: "asc" as const } },
  { user: { lastName: "asc" as const } },
];

// ── Die Zahlen oben ───────────────────────────────────────────────────────────

/**
 * Kennzahlen des Projekts.
 *
 * Zwei Sorten stehen hier nebeneinander, und der Unterschied ist wichtig genug
 * für diesen Absatz: `open`, `inProgress`, `urgent` und `total` sind Bestände —
 * sie gelten *jetzt* und kennen keinen Zeitraum. `created` und `closed` sind
 * Bewegungen im gewählten Fenster. Ein Bestand, den man mit dem Zeitraum
 * filterte, beantwortete keine Frage, die jemand stellt: „wie viel ist offen"
 * meint nie „wie viel ist offen und wurde in den letzten 30 Tagen angelegt".
 */
async function statsFor(
  projectId: string,
  from: Date,
  to: Date,
): Promise<DashboardStats> {
  const window = { gte: from, lt: to };

  const [total, open, inProgress, inReview, created, urgent, urgentUnassigned] =
    await Promise.all([
      db.issue.count({ where: { projectId } }),
      db.issue.count({ where: { projectId, status: { notIn: CLOSED } } }),
      db.issue.count({ where: { projectId, status: "in_progress" } }),
      db.issue.count({ where: { projectId, status: "in_review" } }),
      db.issue.count({ where: { projectId, created: window } }),
      db.issue.count({
        where: { projectId, status: { notIn: CLOSED }, priority: 4 },
      }),
      db.issue.count({
        where: {
          projectId,
          status: { notIn: CLOSED },
          priority: 4,
          assigneeId: null,
        },
      }),
    ]);

  // Zahl und Mittelwert der geschlossenen Aufgaben in einem Zug: beide lesen
  // dieselben Zeilen, und die Durchlaufzeit ist in SQL eine Subtraktion, die in
  // JavaScript ein zweiter Datenweg wäre.
  const [cycle] = await db.$queryRaw<
    { closed: bigint; avg_days: number | null }[]
  >`
    SELECT COUNT(*)                                                   AS closed,
           AVG(EXTRACT(EPOCH FROM ("closedAt" - "created")) / 86400.0) AS avg_days
      FROM "Issue"
     WHERE "projectId" = ${projectId}
       AND "closedAt" >= ${from}
       AND "closedAt" <  ${to}
  `;

  return {
    total,
    open,
    inProgress,
    inReview,
    created,
    urgent,
    urgentUnassigned,
    closed: Number(cycle?.closed ?? 0),
    // Auf eine Nachkommastelle: „19,0 Tage" ist eine Angabe, „19,04871" wäre
    // eine Behauptung von Genauigkeit, die diese Zahl nicht hat.
    cycleDays:
      cycle?.avg_days == null ? null : Math.round(cycle.avg_days * 10) / 10,
  };
}

// ── Verteilungen ──────────────────────────────────────────────────────────────

/**
 * Wie sich alle Aufgaben auf die Status verteilen.
 *
 * Die Reihenfolge kommt aus den Workspace-Status, nicht aus dem Ergebnis der
 * Gruppierung: der Balken soll die Leiter von „Backlog" bis „Canceled"
 * abbilden, und ein Status ohne Aufgaben darf nicht wegfallen — dass er leer
 * ist, ist die Auskunft.
 */
async function statusesFor(
  projectId: string,
  workspaceId: string,
): Promise<StatusSlice[]> {
  const [statuses, rows] = await Promise.all([
    getStatuses(workspaceId),
    db.issue.groupBy({
      by: ["status"],
      where: { projectId },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map(rows.map((row) => [row.status, row._count._all]));
  return statuses.map((status) => ({
    id: status.id,
    name: status.name,
    short: status.short,
    color: status.color,
    count: counts.get(status.id) ?? 0,
  }));
}

/**
 * Wie sich die **offenen** Aufgaben auf die Dringlichkeiten verteilen.
 *
 * Bewusst nur die offenen: was erledigt ist, war einmal dringend und ist es
 * nicht mehr. Die Frage hinter diesem Baustein lautet „was liegt an", nicht
 * „was lag einmal an".
 */
async function prioritiesFor(
  projectId: string,
  workspaceId: string,
): Promise<PrioritySlice[]> {
  const [priorities, rows] = await Promise.all([
    getPriorities(workspaceId),
    db.issue.groupBy({
      by: ["priority"],
      where: { projectId, status: { notIn: CLOSED } },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map(rows.map((row) => [row.priority, row._count._all]));
  return (
    priorities
      .map((priority) => ({
        id: priority.id,
        key: priority.key,
        name: priority.name,
        color: priority.color,
        count: counts.get(priority.id) ?? 0,
      }))
      // Absteigend: die dringendste Zeile zuerst. „Keine Priorität" landet damit
      // unten, wo sie hingehört — sie ist kein Nullwert, sondern das Ende der
      // Leiter.
      .sort((a, b) => b.id - a.id)
  );
}

/**
 * Angelegt und geschlossen je Marke der Zeitachse.
 *
 * Zwei Reihen aus zwei Spalten derselben Tabelle, deshalb zwei Abfragen: ein
 * `UNION` sparte einen Aufruf und kostete die Lesbarkeit. `date_trunc` bekommt
 * die Einheit als Parameter — das erste Argument ist Text, das darf es;
 * Bezeichner stehen fest in der Abfrage.
 */
async function throughputFor(
  projectId: string,
  unit: BucketUnit,
  from: Date,
  to: Date,
  keys: string[],
): Promise<ThroughputPoint[]> {
  const countsIn = async (column: "created" | "closedAt") => {
    const rows = await db.$queryRaw<{ bucket: Date; count: bigint }[]>`
      SELECT date_trunc(${unit}, ${Prisma.raw(`"${column}"`)}) AS bucket,
             COUNT(*) AS count
        FROM "Issue"
       WHERE "projectId" = ${projectId}
         AND ${Prisma.raw(`"${column}"`)} >= ${from}
         AND ${Prisma.raw(`"${column}"`)} <  ${to}
       GROUP BY 1
    `;
    return new Map(
      rows.map((row) => [bucketKey(row.bucket), Number(row.count)]),
    );
  };

  const [created, closed] = await Promise.all([
    countsIn("created"),
    countsIn("closedAt"),
  ]);

  // Die Achse führt, nicht das Ergebnis der Gruppierung: jeder Topf kommt vor,
  // auch der leere.
  return keys.map((date) => ({
    date,
    created: created.get(date) ?? 0,
    closed: closed.get(date) ?? 0,
  }));
}

/**
 * Wer wie viel offene Arbeit trägt.
 *
 * Der Stapel ohne Zuständige steht mit in der Liste und nicht daneben: er ist
 * die Menge, um die es beim Verteilen geht, und ein Projekt, in dem er der
 * größte Balken ist, hat genau das als Befund.
 *
 * Gezählt wird über alle Aufgaben, nicht über die Projektmitglieder: wer das
 * Projekt verlassen hat, aber noch auf Aufgaben steht, verschwände sonst aus
 * der Rechnung, obwohl seine Arbeit liegen bleibt.
 */
async function workloadFor(projectId: string): Promise<WorkloadRow[]> {
  const rows = await db.issue.groupBy({
    by: ["assigneeId", "status"],
    where: { projectId, status: { notIn: CLOSED } },
    _count: { _all: true },
  });
  if (rows.length === 0) return [];

  const ids = [
    ...new Set(
      rows.map((row) => row.assigneeId).filter((id): id is string => !!id),
    ),
  ];
  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: USER_SELECT,
  });
  const byId = new Map(users.map((user) => [user.id, mapUser(user)]));

  const totals = new Map<string, { open: number; inProgress: number }>();
  for (const row of rows) {
    // Ein leerer Schlüssel für „niemand" — `null` ginge als Map-Schlüssel, wäre
    // aber im Typ der Map eine zweite Möglichkeit, die weiter unten jeder Leser
    // mitdenken müsste.
    const key = row.assigneeId ?? "";
    const entry = totals.get(key) ?? { open: 0, inProgress: 0 };
    entry.open += row._count._all;
    if (row.status === "in_progress") entry.inProgress += row._count._all;
    totals.set(key, entry);
  }

  return (
    [...totals.entries()]
      .map(([id, counts]) => ({
        user: id ? (byId.get(id) ?? null) : null,
        ...counts,
      }))
      // Der größte Stapel zuerst; bei Gleichstand entscheidet der Name, damit die
      // Liste zwischen zwei Aufrufen nicht springt.
      .sort(
        (a, b) =>
          b.open - a.open ||
          (a.user?.firstName ?? "").localeCompare(b.user?.firstName ?? ""),
      )
  );
}

// ── Die beiden Listen ─────────────────────────────────────────────────────────

function issueRef(prefix: string, key: number): string {
  return `${prefix}-${key}`;
}

/**
 * Was liegen zu bleiben droht.
 *
 * Drei Gründe, in dieser Rangfolge: dringend und niemandem zugewiesen, dringend
 * überhaupt, seit zwei Wochen unangerührt in Arbeit. Eine Aufgabe kann mehrere
 * erfüllen — gezeigt wird der schwerste, und sie steht nur einmal da.
 *
 * Bewusst keine Suche über alles, was schiefgehen könnte: die Liste ist kurz und
 * soll es bleiben. Eine „Braucht Aufmerksamkeit"-Liste mit vierzig Zeilen
 * braucht selbst keine Aufmerksamkeit mehr.
 */
async function attentionFor(
  projectId: string,
  prefix: string,
  statusColors: Map<string, string>,
): Promise<AttentionIssue[]> {
  const staleBefore = new Date(Date.now() - STALE_DAYS * 86400_000);

  const rows = await db.issue.findMany({
    where: {
      projectId,
      status: { notIn: CLOSED },
      OR: [
        { priority: { gte: 3 } },
        { status: "in_progress", updated: { lt: staleBefore } },
      ],
    },
    select: {
      id: true,
      key: true,
      title: true,
      status: true,
      priority: true,
      updated: true,
      assignee: { select: USER_SELECT },
    },
    // Dringlichkeit vor Alter: was am längsten liegt, ist nicht automatisch das,
    // was am dringendsten ist.
    orderBy: [{ priority: "desc" }, { updated: "asc" }],
    take: LIST_LIMIT,
  });

  return rows.map((row) => {
    const reason: AttentionReason =
      row.priority === 4 && !row.assignee
        ? "unassigned"
        : row.priority >= 3
          ? "urgent"
          : "stale";

    return {
      id: row.id,
      ref: issueRef(prefix, row.key),
      title: row.title,
      status: row.status,
      statusColor: statusColors.get(row.status) ?? "#8a9099",
      priority: row.priority,
      assignee: row.assignee ? mapUser(row.assignee) : null,
      updated: row.updated.getTime(),
      reason,
    } satisfies AttentionIssue;
  });
}

// ── Der Steckbrief ────────────────────────────────────────────────────────────

/**
 * Die Mitglieder nach ihrer Projektrolle bündeln, stärkste Rolle zuerst.
 *
 * Gruppiert wird nach dem, was in der Datenbank steht, und nicht nach einer
 * Liste bekannter Rollen im Code. Das ist hier keine Bequemlichkeit, sondern der
 * Punkt: neben den System-Rollen gibt es projekteigene (`Role.scope = PROJECT`
 * mit gesetzter `projectId`, siehe `prisma/schema.prisma`). Legt sich ein
 * Workspace eine Rolle „Moderator" an, erscheint sie hier von selbst als eigene
 * Gruppe mit ihrem Namen — mit einer festen Liste wären genau diese Rollen die,
 * die durchs Raster fielen.
 *
 * `distinguished` trennt die Gruppen, die oben mit Namen und Chip stehen, von
 * denen, die als Liste darunter laufen. Zwei Bedingungen, und beide braucht es:
 *
 *   - **mindestens der Rang der Mitarbeit.** Eine eigene Rolle unterhalb davon
 *     („Praktikant") ist keine Auszeichnung und gehört in die Liste.
 *   - **keine der System-Rollen, die Mitarbeit oder Mitlesen bedeuten**
 *     (`ROSTER_ROLE_KEYS`). Sonst bekäme jeder Contributor eine eigene Zeile mit
 *     Chip, und bei vierzig Leuten wäre die Karte eine Wand.
 *
 * Zusammen heißt das: die Leitung und alles, was sich ein Workspace daneben
 * selbst geschaffen hat, steht mit Namen; die Mitarbeitenden und Mitlesenden
 * stehen als Liste.
 */
function groupByRole(
  members: {
    user: Parameters<typeof mapUser>[0];
    role: { key: string; name: string; rank: number };
  }[],
): ProjectRoleGroup[] {
  const groups = new Map<string, ProjectRoleGroup>();

  for (const member of members) {
    const existing = groups.get(member.role.key);
    if (existing) {
      existing.members.push(mapUser(member.user));
      continue;
    }
    groups.set(member.role.key, {
      key: member.role.key,
      name: member.role.name,
      rank: member.role.rank,
      distinguished:
        member.role.rank >= CONTRIBUTOR_RANK &&
        !ROSTER_ROLE_KEYS.has(member.role.key),
      members: [mapUser(member.user)],
    });
  }

  // Nach Rang absteigend; bei gleichem Rang nach Namen, damit die Reihenfolge
  // zwischen zwei Aufrufen nicht springt.
  return [...groups.values()].sort(
    (a, b) => b.rank - a.rank || a.name.localeCompare(b.name),
  );
}

/**
 * Was das Projekt ist, unabhängig davon, wie es gerade läuft.
 *
 * Nichts hiervon kennt einen Zeitraum, und genau deshalb steht es nicht in
 * `ProjectDashboardData`: ein Kürzel hat keine 30 Tage. Beides kommt trotzdem
 * aus einem Aufruf — die Seite zeigt beide Ansichten aus denselben Daten und
 * schaltet ohne Serverlauf zwischen ihnen um.
 *
 * Die Mitgliederliste ist `ProjectMember` und damit dieselbe Quelle, aus der
 * `lib/permissions.ts` den Zugriff entscheidet. Owner und Admins des Workspace,
 * die jedes Projekt sehen, ohne darin einzutragen zu sein, fehlen hier deshalb —
 * das ist Absicht: der Steckbrief zeigt, wer im Projekt *arbeitet*, nicht wer
 * überall hineinsehen darf. Wer die vollständige Zugriffsliste braucht, findet
 * sie unter „Mitglieder" (`getProjectMembersView`).
 */
async function profileFor(projectId: string): Promise<ProjectProfile | null> {
  // Dieselbe Erlaubnis, die auch die Einstellungsseite prüft
  // (`getProjectSettingsView`) — der Knopf soll genau dort erscheinen, wo er
  // auch zu etwas führt.
  const access = await accessFor(await currentUserId(), { projectId });

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      desc: true,
      prefix: true,
      visibility: true,
      createdAt: true,
      createdBy: { select: USER_SELECT },
      members: {
        select: {
          user: { select: USER_SELECT },
          role: { select: { key: true, name: true, rank: true } },
        },
        orderBy: byName,
      },
      teams: {
        select: {
          team: { select: { id: true, name: true, key: true, color: true } },
        },
      },
      labels: {
        select: { id: true, name: true, color: true },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!project) return null;

  // Die Workspace-Labels gelten in jedem Projekt — bis auf die, die dieses
  // Projekt ausgeblendet hat. Ohne diesen zweiten Teil zeigte der Steckbrief nur
  // die projekteigenen und behauptete damit, es gäbe sonst keine.
  const shared = await db.label.findMany({
    where: {
      projectId: null,
      workspace: { projects: { some: { id: projectId } } },
      hiddenIn: { none: { projectId } },
    },
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });

  return {
    desc: project.desc,
    prefix: project.prefix,
    visibility: project.visibility,
    createdAt: project.createdAt.getTime(),
    createdBy: project.createdBy ? mapUser(project.createdBy) : null,
    canUpdate: access.has("project.update"),
    roles: groupByRole(project.members),
    memberCount: project.members.length,
    teams: project.teams.map((entry) => entry.team),
    labels: [
      ...project.labels.map((label) => ({ ...label, own: true })),
      ...shared.map((label) => ({ ...label, own: false })),
    ],
  };
}

// ── Die Anordnung, wie einer sie eingerichtet hat ─────────────────────────────

/**
 * Die eigene Anordnung für dieses Projekt.
 *
 * Ohne Zeile in der Tabelle gilt die Vorgabe — `resolveLayout` kennt den
 * Unterschied nicht und muss ihn nicht kennen. Auch der Zeitraum steht hier: er
 * ist die eine Einstellung, die man bei jedem Öffnen wieder träfe.
 */
export const getMyDashboardLayout = cache(
  async (
    projectId: string,
  ): Promise<{
    order: string[];
    hidden: string[];
    range: string | null;
    view: string | null;
  }> => {
    const session = await getSession();
    if (!session) return { order: [], hidden: [], range: null, view: null };

    const row = await db.dashboardPreference.findUnique({
      where: { userId_projectId: { userId: session.userId, projectId } },
    });
    return {
      order: row?.order ?? [],
      hidden: row?.hidden ?? [],
      range: row?.range ?? null,
      view: row?.view ?? null,
    };
  },
);

// ── Alles zusammen ────────────────────────────────────────────────────────────

/**
 * Das ganze Dashboard eines Projekts.
 *
 * Alle Bausteine werden geladen, auch die ausgeblendeten. Das ist eine bewusste
 * Entscheidung gegen das Naheliegende: wer nur das Sichtbare lädt, spart ein
 * paar Zählabfragen und handelt sich dafür ein, dass jedes Ein- und Ausblenden
 * im Anpassen-Dialog einen neuen Serverlauf braucht — die Vorschau im Dialog
 * wäre dann leer, bis sie nachlädt. Die Abfragen sind Zählungen über einen
 * Index; die teuersten beiden Listen haben ein `take` von sechs.
 */
export const getProjectDashboard = cache(
  async (
    projectId: string,
    range: RangeKey,
  ): Promise<ProjectDashboardView | null> => {
    if (!(await hasPermission("project.view", { projectId }))) return null;
    if (!(await currentUserId())) return null;

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        prefix: true,
        workspaceId: true,
      },
    });
    if (!project) return null;

    const window = windowFor(range);

    const [stats, statuses, priorities, throughput, workload, profile, layout] =
      await Promise.all([
        statsFor(projectId, window.from, window.to),
        statusesFor(projectId, project.workspaceId),
        prioritiesFor(projectId, project.workspaceId),
        throughputFor(
          projectId,
          window.unit,
          window.from,
          window.to,
          window.keys,
        ),
        workloadFor(projectId),
        profileFor(projectId),
        getMyDashboardLayout(projectId),
      ]);
    if (!profile) return null;

    // Braucht die Farben der Status und wartet deshalb auf `statuses` — eine
    // zweite Abfrage derselben Tabelle wäre der einzige Weg, das zu parallelisieren.
    const attention = await attentionFor(
      projectId,
      project.prefix,
      new Map(statuses.map((status) => [status.id, status.color])),
    );

    const resolved = resolveLayout(layout.order, layout.hidden);

    const data: ProjectDashboardData = {
      range,
      unit: window.unit,
      stats,
      statuses,
      priorities,
      throughput,
      workload,
      attention,
    };

    return {
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        color: project.color,
      },
      data,
      profile,
      order: resolved.visible,
      hidden: resolved.hidden,
    } satisfies ProjectDashboardView;
  },
);

/** Der Zeitraum, mit dem das Dashboard ohne `?range=` in der Adresse aufgeht. */
export async function getMyDashboardRange(
  projectId: string,
): Promise<string | null> {
  return (await getMyDashboardLayout(projectId)).range;
}

/**
 * Die Ansicht, in der die Projektseite ohne `?view=` in der Adresse aufgeht —
 * die zuletzt benutzte. `null`, solange niemand umgeschaltet hat.
 */
export async function getMyDashboardView(
  projectId: string,
): Promise<string | null> {
  return (await getMyDashboardLayout(projectId)).view;
}
