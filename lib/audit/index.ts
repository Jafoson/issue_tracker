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
  workspaceId?: string | null;
  projectId?: string | null;
  /** Die Begründung — beim Notfall-Zugriff Pflicht, sonst leer. */
  reason?: string | null;
  meta?: Prisma.InputJsonValue;
}

/** Der schmale Ausschnitt von `db`, den das Protokoll braucht. */
type AuditClient = Pick<typeof db, "auditLog" | "user">;

const UNKNOWN_ACTOR = "Unbekannt";

/**
 * Wie der Handelnde zur Tatzeit hieß.
 *
 * Der Name wird beim Schreiben eingefroren, nicht beim Lesen aufgelöst. Wer
 * später heiratet, das Konto umbenennt oder gelöscht wird, verändert damit nicht
 * rückwirkend, was im Protokoll steht — und ein gelöschtes Konto hinterlässt
 * keine Zeile ohne Namen.
 */
async function labelFor(
  client: AuditClient,
  actorId: string | null | undefined,
  fallback: string | undefined,
): Promise<string> {
  if (!actorId) return fallback?.trim() || UNKNOWN_ACTOR;
  const user = await client.user.findUnique({
    where: { id: actorId },
    select: { firstName: true, lastName: true, email: true },
  });
  if (!user) return fallback?.trim() || UNKNOWN_ACTOR;
  return `${user.firstName} ${user.lastName} (${user.email})`.trim();
}

function rowFor(input: AuditInput, actorLabel: string) {
  return {
    action: input.action,
    actorId: input.actorId ?? null,
    actorLabel,
    targetType: input.target?.type ?? null,
    targetId: input.target?.id ?? null,
    targetLabel: input.target?.label ?? null,
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
  const actorLabel = await labelFor(client, input.actorId, input.actorLabel);
  await client.auditLog.create({ data: rowFor(input, actorLabel) });
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
  action?: AuditAction;
  actorId?: string;
  /** Wie viele Zeilen höchstens. Vorgabe 100, Obergrenze 500. */
  limit?: number;
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
  return db.auditLog.findMany({
    where: {
      ...(filter.workspaceId ? { workspaceId: filter.workspaceId } : {}),
      ...(filter.action ? { action: filter.action } : {}),
      ...(filter.actorId ? { actorId: filter.actorId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      createdAt: true,
      action: true,
      actorId: true,
      actorLabel: true,
      targetType: true,
      targetId: true,
      targetLabel: true,
      workspaceId: true,
      projectId: true,
      reason: true,
      // `meta` steht bewusst nicht in der Auswahl: es trägt je Vorgang etwas
      // anderes und gehört in die Datenbanksicht, nicht in die Liste.
    },
  });
}

/** Wie viele Vorgänge es insgesamt gibt — für die Übersicht. */
export async function countAudit(filter: AuditFilter = {}): Promise<number> {
  return db.auditLog.count({
    where: {
      ...(filter.workspaceId ? { workspaceId: filter.workspaceId } : {}),
      ...(filter.action ? { action: filter.action } : {}),
    },
  });
}
