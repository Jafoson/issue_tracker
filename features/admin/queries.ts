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

// ─── Plattform-Ebene: die Hülle des Systems ───────────────────────────────────
//
// Workspace-übergreifende Abfragen für `/admin`. Nur in Server Components und
// Layouts verwenden (DB-Zugriff).
//
// **Die Grenze dieser Datei ist zugleich eine fachliche Zusage.** Die
// Plattformverwaltung sieht das System, nicht das, was darin gearbeitet wird:
// Konten, Rollen, Workspaces, Projekt-Stammdaten, das Protokoll. Kein Issue,
// kein Kommentar, kein Anhang, kein Beschreibungstext — nicht gefiltert,
// sondern gar nicht erst geladen. Wer hier eine Abfrage ergänzt, die
// `issue`, `comment` oder eine Textspalte daraus liest, hebt diese Zusage auf.
//
// Wer in ein Projekt hineinsehen muss, nimmt einen der beiden dafür gedachten
// Wege — und beide sind sichtbar: `tenant.access` (Support-Rolle) oder den
// Notfall-Zugriff aus `features/admin/actions.ts`, der eine Begründung verlangt
// und im Protokoll landet.
//
// Das gilt auch für das Dashboard weiter unten: es zählt Aufgaben und
// Kommentare, es liest keine. Eine Zahl über der Zeit sagt, wie viel gearbeitet
// wurde — kein Wort davon, woran.
//
// Jede Abfrage prüft selbst. Das Layout in `app/[locale]/(default)/admin` tut
// das zwar auch, aber ein Layout ist keine Sicherheitsgrenze: es schützt nur die
// Seiten unter sich, nicht jeden Aufruf dieser Funktionen.

async function requirePlatformAccess(): Promise<void> {
  await requirePermission("platform.access", PLATFORM);
}

/** Die Plattform-Rolle eines Users, so weit die Oberfläche sie braucht. */
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
 * Ein Konto, wie die Benutzerverwaltung es zeigt.
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
  /** Gesetzt heißt stillgelegt: kein Zutritt, keine Rechte. */
  deactivatedAt: Date | null;
  /** Ob ein Passkey hinterlegt ist. Sonst: verbundener Anbieter oder
   *  Einladung noch nicht angenommen. */
  hasPasskey: boolean;
  /** Konto steht, aber die Einladung ist noch nirgends angenommen. */
  invitePending: boolean;
}

const platformRoleSelect = {
  select: { key: true, name: true },
} as const satisfies Prisma.RoleDefaultArgs;

export interface PlatformStats {
  workspaces: number;
  users: number;
  projects: number;
  /** Konten, die stillgelegt sind — sie zählen in `users` mit. */
  deactivatedUsers: number;
  /** Projekte ohne Besitzer: gelöschtes Konto, niemand zuständig. */
  orphanedProjects: number;
  /** Notfall-Zugriffe der letzten 30 Tage. Sollte klein sein und bleiben. */
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
 * Alle Konten, seitenweise. `limit` ungesetzt heißt unbegrenzt — so ruft es die
 * Besitzer-Zuordnung in `AdminProjectsPage` auf, die jedes Konto zur Auswahl
 * braucht, nicht nur die erste Seite. Die Benutzerverwaltung selbst
 * (`AdminUsersPage`) setzt `limit` explizit für Infinite Scroll.
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

/** Eine vergebbare Plattform-Rolle. */
export interface PlatformRoleOption {
  id: string;
  key: string;
  name: string;
  rank: number;
}

/**
 * Die Rollen, die es auf der Plattform-Ebene gibt — für die Auswahl in der
 * Benutzerverwaltung. Welche davon jemand tatsächlich vergeben darf, entscheidet
 * `setPlatformRole` am Rang; die Liste selbst ist keine Erlaubnis.
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
 * Ein Projekt, wie die Plattformverwaltung es sieht: seine Hülle.
 *
 * Name, Ort, Besitzer, Alter, Zustand, Größe — genug, um verwaiste Projekte zu
 * finden, Kosten zuzuordnen und aufzuräumen. Die Zahlen sind Zählungen, keine
 * Inhalte: `issueCount` sagt, wie viel darin liegt, nicht was.
 */
export interface PlatformProject {
  id: string;
  name: string;
  slug: string;
  color: string;
  visibility: "public" | "private";
  createdAt: Date;
  archivedAt: Date | null;
  workspace: { id: string; name: string; color: string; suspended: boolean };
  /** Wer es angelegt hat — null, wenn das Konto gelöscht wurde. */
  owner: { id: string; firstName: string; lastName: string } | null;
  memberCount: number;
  issueCount: number;
  /**
   * Ohne Besitzer oder ohne ein einziges Mitglied — niemand ist mehr zuständig.
   * Genau die Zeilen, für die es die Neuzuordnung gibt.
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
        visibility: true,
        createdAt: true,
        archivedAt: true,
        workspace: {
          select: { id: true, name: true, color: true, suspended: true },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        // Zählungen, keine Zeilen: die Oberfläche zeigt „14 Aufgaben", nicht deren
        // Titel. Ein `select` auf `issues` stünde hier nie.
        _count: { select: { members: true, issues: true } },
      },
    });

    return {
      rows: rows.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        color: p.color,
        visibility: p.visibility,
        createdAt: p.createdAt,
        archivedAt: p.archivedAt,
        workspace: p.workspace,
        owner: p.createdBy,
        memberCount: p._count.members,
        issueCount: p._count.issues,
        orphaned: p.createdBy === null || p._count.members === 0,
      })),
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
 * Das Protokoll der ganzen Plattform.
 *
 * `audit.view` und nicht `platform.access`: den Bereich zu betreten ist eine
 * Sache, das Protokoll zu lesen eine andere. Wer es lesen darf, sieht darin auch
 * die eigenen Zeilen — ein Protokoll, das seinen Leser ausspart, wäre keins.
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

// Ziel für den „Zurück"-Button: der erste Workspace des Users (oder null).
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
// Zahlen über die Zeit: wie viel angelegt wurde, und wie sich das gegenüber dem
// Zeitraum davor verhält.
//
// Gruppiert wird in der Datenbank (`date_trunc`), nicht in JavaScript. Der
// naheliegende Weg — alle Zeitstempel holen und im Speicher zählen — überträgt
// bei einem Jahr Betrieb Hunderttausende Zeilen, um am Ende zwölf Zahlen zu
// zeigen. Die Achse selbst entsteht dagegen im Code (`lib/buckets.ts`): eine
// Gruppierung kennt nur Töpfe, in denen etwas liegt, und ein ruhiges Wochenende
// wäre sonst keine Null, sondern ein Loch.

/** Eine Marke der Zeitachse mit allem, was in ihren Topf fiel. */
export interface DashboardPoint {
  /** Anfang des Topfes, `YYYY-MM-DD`. */
  date: string;
  issues: number;
  comments: number;
  projects: number;
  users: number;
  workspaces: number;
  /** Erfolgreiche Anmeldungen — aus dem Protokoll, nicht aus `User`. */
  logins: number;
  /** Gescheiterte Versuche: falsches Passwort, unbekanntes oder stillgelegtes Konto. */
  failedLogins: number;
}

/** Was im Zeitraum entstanden ist. */
export interface DashboardTotals {
  issues: number;
  comments: number;
  projects: number;
  users: number;
  workspaces: number;
}

/** Ein Workspace, gemessen an seinem Umfang — Stammdaten, keine Inhalte. */
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
  /** Im gewählten Zeitraum entstanden. */
  totals: DashboardTotals;
  /** Im gleich langen Zeitraum davor entstanden — die Bezugsgröße der Trends. */
  previous: DashboardTotals;
  /** Der Gesamtbestand, unabhängig vom Zeitraum. */
  allTime: DashboardTotals;
  topWorkspaces: WorkspaceSize[];
}

/**
 * Die Tabellen, aus denen das Dashboard zählt — mit der Spalte, die den
 * Zeitpunkt trägt.
 *
 * Fest verdrahtet und nicht von außen bestimmbar: Tabellen- und Spaltennamen
 * lassen sich in SQL nicht als Parameter übergeben, sie werden in die Abfrage
 * geschrieben. Käme hier ein Wert von außen herein, wäre das eine Einladung.
 * Deshalb steht die Liste hier, und `countsByBucket` nimmt nur Schlüssel daraus.
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
 * Wie viel je Topf entstanden ist.
 *
 * `date_trunc` bekommt die Einheit als Parameter — das erste Argument ist Text,
 * das darf es. Tabelle und Spalte dagegen sind Bezeichner und kommen aus
 * `SOURCES`, nie von außen.
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
 * Anmeldungen je Topf, gelungene und gescheiterte.
 *
 * Die Quelle ist das Protokoll und nicht `User.lastSeenAt`: dort steht nur der
 * letzte Zeitpunkt je Konto, aus dem sich kein Verlauf bauen lässt. Das
 * Protokoll hält jeden Vorgang einzeln fest — genau dafür ist es da.
 *
 * Beide Reihen in einer Abfrage: sie unterscheiden sich nur in einer Spalte.
 * Die Schlüssel kommen als Werte aus `lib/audit/actions.ts`, damit eine
 * Umbenennung dort hier den Typecheck bricht statt still eine leere Reihe zu
 * liefern.
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

/** Wie viel es in einem Zeitfenster insgesamt gab. */
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
 * Die größten Workspaces, gemessen an ihren Aufgaben.
 *
 * Für die Frage, wo die Last liegt — und wem sie zuzurechnen ist. Gezählt wird
 * über die Projekte des Workspace; gelesen wird nichts davon.
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
        // Ohne Zeitgrenze: der Bestand ist die Bezugsgröße, vor der die
        // Bewegung im Zeitraum überhaupt eine Bedeutung bekommt.
        totalsIn(new Date(0), new Date(8.64e15)),
        largestWorkspaces(5),
      ]);

    const byKey = new Map(
      SOURCE_KEYS.map((source, index) => [source, buckets[index]]),
    );

    // Die Achse führt, nicht das Ergebnis der Gruppierung: jeder Topf kommt vor,
    // auch der leere.
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
// Ein Workspace ist auf dieser Ebene ein Mandant: eine Hülle mit einem Namen,
// einem Verantwortlichen, einer Größe und einem Zustand. Was darin gearbeitet
// wird, steht auch hier nicht — `issues` ist eine Zählung, und einen Weg hinein
// gibt es von dieser Liste aus nicht.

/** Ein Workspace, wie die Plattformverwaltung ihn sieht. */
export interface PlatformWorkspace {
  id: string;
  name: string;
  slug: string;
  color: string;
  createdAt: Date;
  /** Gesperrt: niemand kommt hinein, auch die Leitung nicht. */
  suspended: boolean;
  /**
   * Wer ihn führt — das Mitglied mit der Owner-Rolle. Null, wenn es keines mehr
   * gibt: dann ist der Mandant führungslos und niemand kann ihn verwalten.
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
   * Wann zuletzt eine Aufgabe angelegt wurde. Das grobe Maß für „wird der
   * Mandant überhaupt noch benutzt" — null heißt: noch nie.
   */
  lastActivityAt: Date | null;
}

/**
 * Alle Workspaces der Plattform.
 *
 * Nur `platform.access` und keine eigene Leseberechtigung: dieselbe Auskunft
 * steht bereits auf dem Dashboard (Bestand, größte Workspaces), und beide
 * Plattform-Rollen brauchen sie — der Support, um einen Mandanten zu finden,
 * die Verwaltung, um ihn zu betreuen. Eine zusätzliche Hürde vor der Liste
 * schützte nichts, was nicht eine Seite weiter ohnehin sichtbar wäre.
 *
 * Anfassen ist eine andere Frage: dafür gelten `workspace.suspend` und
 * `workspace.delete` (siehe `features/admin/actions.ts`).
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
          createdAt: true,
          suspended: true,
          _count: { select: { members: true, projects: true } },
          projects: { select: { _count: { select: { issues: true } } } },
          // Nur die Leitung, nicht die Mitgliederliste: wer im Mandanten ist,
          // steht in der Benutzerverwaltung, und hier zählt, wer zuständig ist.
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
      // Ein Zug für alle Mandanten. Über `Project` verbunden, weil eine Aufgabe
      // den Workspace nicht selbst kennt.
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
      rows: rows.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        color: workspace.color,
        createdAt: workspace.createdAt,
        suspended: workspace.suspended,
        owner: workspace.members[0]?.user ?? null,
        members: workspace._count.members,
        projects: workspace._count.projects,
        issues: workspace.projects.reduce((sum, p) => sum + p._count.issues, 0),
        lastActivityAt: lastByWorkspace.get(workspace.id) ?? null,
      })),
      nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
    };
  },
);
