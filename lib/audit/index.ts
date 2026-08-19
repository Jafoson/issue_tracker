import "server-only";
import type { AuditAction, AuditEntry, AuditTarget } from "@/lib/audit/actions";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

// ─── Audit-Log: schreiben und lesen ───────────────────────────────────────────
//
// Die Vorgänge selbst stehen in `lib/audit/actions.ts` — abhängigkeitsfrei,
// damit die Oberfläche sie benennen kann, ohne den Prisma-Client ins Bündel zu
// ziehen. Hier steht, was nur der Server tut.
//
// ── Zwei Wege hinein ──
//
// `recordAudit` schluckt seine Fehler: eine Anmeldung soll nicht scheitern, weil
// das Protokoll klemmt. `recordAuditIn` schreibt in eine laufende Transaktion
// und schluckt nichts — für Vorgänge, bei denen der Eintrag der eigentliche
// Punkt ist. Der Notfall-Zugriff nutzt diesen Weg: die Mitgliedschaft und ihr
// Protokolleintrag entstehen zusammen oder gar nicht.

// Die Registry wandert weiter durch dieses Modul hinaus: der Server-Code
// importiert `@/lib/audit` und bekommt beides, ohne zwei Pfade zu kennen. Wer
// im Browser rendert, importiert `@/lib/audit/actions` direkt.
export * from "@/lib/audit/actions";

export interface AuditInput {
  action: AuditAction;
  /** Wer gehandelt hat. Die Beschriftung wird daraus nachgeladen. */
  actorId?: string | null;
  /**
   * Beschriftung des Handelnden, wenn es keine Id gibt — bei einer
   * fehlgeschlagenen Anmeldung steht hier die getippte Adresse. Ist beides
   * gesetzt, gewinnt der nachgeladene Name.
   */
  actorLabel?: string;
  target?: AuditTarget;
  /**
   * Kontofarbe der Person, um die es geht, wenn das Ziel selbst keine Person
   * ist — bei einer Zuweisung etwa das Ziel „Issue", nicht der neue Zuständige.
   * Frei, weil nicht jeder Vorgang eine Person nennt.
   */
  personColor?: string | null;
  workspaceId?: string | null;
  projectId?: string | null;
  /** Die Begründung — beim Notfall-Zugriff Pflicht, sonst leer. */
  reason?: string | null;
  meta?: Prisma.InputJsonValue;
}

/** Der schmale Ausschnitt von `db`, den das Protokoll braucht. */
type AuditClient = Pick<typeof db, "auditLog" | "user">;

const UNKNOWN_ACTOR = "Unbekannt";

interface ActorInfo {
  label: string;
  color: string | null;
}

/**
 * Wie der Handelnde zur Tatzeit hieß und aussah (Avatar-Farbe).
 *
 * Beides wird beim Schreiben eingefroren, nicht beim Lesen aufgelöst. Wer
 * später heiratet, das Konto umbenennt, die Farbe wechselt oder gelöscht wird,
 * verändert damit nicht rückwirkend, was im Protokoll steht — und ein
 * gelöschtes Konto hinterlässt keine Zeile ohne Namen (nur ohne Farbe, dann
 * zeigt die Liste den Platzhalter-Avatar).
 */
async function actorInfoFor(
  client: AuditClient,
  actorId: string | null | undefined,
  fallback: string | undefined,
): Promise<ActorInfo> {
  if (!actorId)
    return { label: fallback?.trim() || UNKNOWN_ACTOR, color: null };
  const user = await client.user.findUnique({
    where: { id: actorId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      handle: true,
      color: true,
    },
  });
  if (!user) return { label: fallback?.trim() || UNKNOWN_ACTOR, color: null };
  // Passkey-Konten ohne Adresse: `@handle` statt der Klammer, damit die Zeile
  // trotzdem eindeutig bleibt, statt „(null)" anzuzeigen.
  return {
    label:
      `${user.firstName} ${user.lastName} (${user.email ?? `@${user.handle}`})`.trim(),
    color: user.color,
  };
}

function rowFor(input: AuditInput, actor: ActorInfo) {
  return {
    action: input.action,
    actorId: input.actorId ?? null,
    actorLabel: actor.label,
    actorColor: actor.color,
    targetType: input.target?.type ?? null,
    targetId: input.target?.id ?? null,
    targetLabel: input.target?.label ?? null,
    personColor: input.personColor ?? null,
    workspaceId: input.workspaceId ?? null,
    projectId: input.projectId ?? null,
    reason: input.reason?.trim() || null,
    ...(input.meta === undefined ? {} : { meta: input.meta }),
  };
}

/**
 * Einen Vorgang protokollieren, in einer laufenden Transaktion.
 *
 * Fehler kommen hier durch. Für Vorgänge, bei denen der Eintrag nicht bloß
 * begleitet, sondern die Bedingung ist: ein Notfall-Zugriff ohne Protokoll wäre
 * genau das, was das Protokoll verhindern soll.
 */
export async function recordAuditIn(
  client: AuditClient,
  input: AuditInput,
): Promise<void> {
  const actor = await actorInfoFor(client, input.actorId, input.actorLabel);
  await client.auditLog.create({ data: rowFor(input, actor) });
}

/**
 * Einen Vorgang protokollieren.
 *
 * Schluckt seine Fehler und meldet sie nur auf der Konsole: eine Anmeldung, ein
 * Rollenwechsel oder eine Löschung soll nicht daran scheitern, dass das
 * Protokoll gerade klemmt. Wer das nicht will, nimmt `recordAuditIn`.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await recordAuditIn(db, input);
  } catch (error) {
    console.error("[audit] Eintrag nicht geschrieben:", input.action, error);
  }
}

// ─── Lesen ────────────────────────────────────────────────────────────────────

export interface AuditFilter {
  /** Nur Vorgänge dieses Workspace. Ohne Angabe: die ganze Plattform. */
  workspaceId?: string;
  /** Nur Vorgänge dieses Projekts. */
  projectId?: string;
  action?: AuditAction;
  actorId?: string;
  /**
   * Nur Vorgänge, die diese Person betreffen — als Handelnde oder als Ziel.
   * Für Ansichten ohne `audit.view`: wer die volle Liste nicht sehen darf,
   * sieht wenigstens, was sie selbst getan hat oder was ihr passiert ist
   * (aufgenommen, entfernt, umrollt). Reine Objekt-Ereignisse, bei denen die
   * Person weder Akteur noch Ziel ist, fallen damit korrekt heraus.
   */
  selfOnly?: string;
  /** Wie viele Zeilen höchstens. Vorgabe 100, Obergrenze 500. */
  limit?: number;
  /** Nachladen ab (ausschließlich) dieser Id, für Infinite Scroll. */
  cursor?: string;
}

/**
 * Issue-Vorgänge und projektgebundene Label-Vorgänge tragen `workspaceId`
 * genauso wie `projectId` (siehe `recordIssueAudit` und `createLabel` in
 * `features/issues/actions.ts`) — nicht, weil sie zum Workspace als Ganzes
 * gehörten, sondern damit sie im Projekt-Feed erscheinen, dessen Query nur
 * `projectId` kennt. Im Workspace-Feed (`workspaceId` ohne `projectId`) wären
 * sie dagegen das Tagesgeschäft jedes einzelnen Projekts, nicht des
 * Workspace — und würden ihn zuspammen. Ein Label ohne `projectId` entsteht
 * direkt im Workspace-Kontext (`WorkspaceLabels`) und bleibt sichtbar.
 */
function whereFor(filter: AuditFilter): Prisma.AuditLogWhereInput {
  const workspaceFeed = filter.workspaceId && !filter.projectId;

  return {
    ...(filter.workspaceId ? { workspaceId: filter.workspaceId } : {}),
    ...(filter.projectId ? { projectId: filter.projectId } : {}),
    ...(filter.action ? { action: filter.action } : {}),
    ...(filter.actorId ? { actorId: filter.actorId } : {}),
    ...(filter.selfOnly
      ? {
          OR: [
            { actorId: filter.selfOnly },
            { targetType: "user", targetId: filter.selfOnly },
          ],
        }
      : {}),
    ...(workspaceFeed
      ? {
          NOT: [
            { action: { startsWith: "issue." } },
            { action: "label.created", projectId: { not: null } },
            { action: "label.deleted", projectId: { not: null } },
          ],
        }
      : {}),
  };
}

/**
 * Das Protokoll lesen, neueste zuerst.
 *
 * Prüft **nicht** selbst — der Ausschnitt ist das Recht. Die Aufrufer stellen
 * `audit.view` im passenden Kontext sicher und geben genau den Ausschnitt vor,
 * für den sie geprüft haben: die Plattformverwaltung alles,
 * eine Workspace-Ansicht nur ihren eigenen `workspaceId`.
 */
export async function listAudit(
  filter: AuditFilter = {},
): Promise<AuditEntry[]> {
  const take = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  const entries = await db.auditLog.findMany({
    where: whereFor(filter),
    orderBy: { createdAt: "desc" },
    take,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      createdAt: true,
      action: true,
      actorId: true,
      actorLabel: true,
      actorColor: true,
      targetType: true,
      targetId: true,
      targetLabel: true,
      personColor: true,
      workspaceId: true,
      projectId: true,
      reason: true,
      // Anders als früher dokumentiert doch in der Auswahl: einige Issue-
      // Vorgänge tragen darin Render-Hinweise (Status-/Prioritäts-Ids,
      // Label-Farben) für Icon und Chip in `TargetLabel`. Der Rest der Zeilen
      // trägt hier `null` und bleibt unberührt.
      meta: true,
    },
  });
  // `projectRef` ist keine Spalte — Platzhalter, den `withProjectRef` befüllt,
  // genau wie `withCurrentColor` es mit fehlender `actorColor` tut.
  const withPlaceholder: AuditEntry[] = entries.map((entry) => ({
    ...entry,
    projectRef: null,
  }));
  return withProjectRef(await withCurrentColor(withPlaceholder));
}

/**
 * Ergänzt die aktuelle Kontofarbe, wo keine eingefroren ist — Zeilen, die vor
 * dieser Spalte entstanden sind. Anders als `actorLabel` gilt für die Farbe
 * keine Historientreue: ein Avatar ohne Farbe wäre nur ein grauer Platzhalter,
 * und die heutige Farbe ist die bessere Auskunft als gar keine. Neue Zeilen
 * bringen ihre Farbe schon mit (`actorInfoFor`) und lösen hier nichts aus.
 */
async function withCurrentColor(entries: AuditEntry[]): Promise<AuditEntry[]> {
  const missing = [
    ...new Set(
      entries
        .filter((e) => e.actorColor === null && e.actorId)
        .map((e) => e.actorId as string),
    ),
  ];
  if (missing.length === 0) return entries;

  const users = await db.user.findMany({
    where: { id: { in: missing } },
    select: { id: true, color: true },
  });
  const colorOf = new Map(users.map((u) => [u.id, u.color]));

  return entries.map((entry) =>
    entry.actorColor === null && entry.actorId && colorOf.has(entry.actorId)
      ? { ...entry, actorColor: colorOf.get(entry.actorId) as string }
      : entry,
  );
}

/**
 * Ergänzt Slug und Name des Projekts, zu dem die Zeile gehört — für den Link
 * in `TargetLabel` (`AuditLog`/`ActivityFeed`). Kein Fremdschlüssel auf
 * `AuditLog` (siehe `prisma/schema.prisma`), also ist das hier der einzige
 * Weg zu einem klickbaren Projekt: eine gebündelte Nachfrage, nicht anders als
 * `withCurrentColor` nebenan. Ein inzwischen gelöschtes Projekt liefert
 * `null` — die Zeile bleibt dann unverlinkter Text statt eines toten Links.
 */
async function withProjectRef(entries: AuditEntry[]): Promise<AuditEntry[]> {
  const projectIds = [
    ...new Set(
      entries.filter((e) => e.projectId).map((e) => e.projectId as string),
    ),
  ];
  if (projectIds.length === 0) return entries;

  const projects = await db.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, slug: true, name: true },
  });
  const refOf = new Map(
    projects.map((p) => [p.id, { slug: p.slug, name: p.name }]),
  );

  return entries.map((entry) =>
    entry.projectId && refOf.has(entry.projectId)
      ? { ...entry, projectRef: refOf.get(entry.projectId) ?? null }
      : entry,
  );
}

/** Wie viele Vorgänge es insgesamt gibt — für die Übersicht. */
export async function countAudit(filter: AuditFilter = {}): Promise<number> {
  return db.auditLog.count({ where: whereFor(filter) });
}
