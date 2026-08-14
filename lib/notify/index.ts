import "server-only";
import type {
  NotificationEvent,
  NotificationKey,
} from "@/features/account/types";
import { db } from "@/lib/db";

// ─── Benachrichtigungen: schreiben ────────────────────────────────────────────
//
// Dasselbe Muster wie `lib/audit`: eine schmale Schreibfunktion, die aus
// mehreren Feature-Domänen heraus aufgerufen wird (issues, workspaces,
// projects), ohne dass diese sich gegenseitig kennen müssen. Fehler werden
// geschluckt und nur geloggt — eine hakende Benachrichtigung darf nie eine
// Zuweisung, einen Kommentar oder einen Rollenwechsel verhindern.

export interface NotifyInput {
  /** Empfänger. */
  userId: string;
  type: NotificationEvent;
  /** Wer die Benachrichtigung ausgelöst hat. Fehlt sie oder ist sie gleich
   *  `userId`, entsteht keine Zeile — niemand benachrichtigt sich selbst. */
  actorId?: string | null;
  workspaceId: string;
  /** Gesetzt = projekt-, `null`/fehlend = workspace-bezogen. */
  projectId?: string | null;
  issueId?: string | null;
  /** Rollenname, Statuskey oder Kommentar-Vorschau, je nach `type`. */
  text?: string;
}

const UNKNOWN_ACTOR = "Unbekannt";

/** Wie beim Audit-Log: der Name wird zur Schreibzeit eingefroren, nicht beim
 *  Lesen aufgelöst — ein später umbenanntes oder verlorenes Konto verändert
 *  damit keine schon zugestellte Benachrichtigung rückwirkend. */
async function actorLabelsFor(
  actorIds: string[],
): Promise<Map<string, string>> {
  if (actorIds.length === 0) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  return new Map(
    users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
  );
}

/** Wer welchen Kanal für welchen Anlass eingestellt hat — fehlt die Zeile,
 *  gilt der Schema-Default (`true` für jede `*InApp`-Spalte). */
async function inAppEnabledFor(
  userIds: string[],
): Promise<Map<string, Partial<Record<NotificationKey, boolean>>>> {
  if (userIds.length === 0) return new Map();
  const rows = await db.userPreferences.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      assignedInApp: true,
      mentionedInApp: true,
      commentInApp: true,
      statusInApp: true,
      inviteInApp: true,
      roleInApp: true,
    },
  });
  return new Map(rows.map(({ userId, ...settings }) => [userId, settings]));
}

/**
 * Legt eine oder mehrere Benachrichtigungen an.
 *
 * Selbstbenachrichtigungen und wer den In-App-Kanal für diesen Anlass
 * abgeschaltet hat, werden vor dem Schreiben herausgefiltert.
 */
export async function notify(
  input: NotifyInput | NotifyInput[],
): Promise<void> {
  const items = (Array.isArray(input) ? input : [input]).filter(
    (i) => i.userId !== i.actorId,
  );
  if (items.length === 0) return;

  try {
    const [prefs, actorLabels] = await Promise.all([
      inAppEnabledFor([...new Set(items.map((i) => i.userId))]),
      actorLabelsFor([
        ...new Set(
          items.map((i) => i.actorId).filter((id): id is string => !!id),
        ),
      ]),
    ]);

    const key = (type: NotificationEvent) => `${type}InApp` as NotificationKey;
    const rows = items
      .filter((i) => (prefs.get(i.userId)?.[key(i.type)] ?? true) === true)
      .map((i) => ({
        userId: i.userId,
        type: i.type,
        workspaceId: i.workspaceId,
        projectId: i.projectId ?? null,
        issueId: i.issueId ?? null,
        actorId: i.actorId ?? null,
        actorLabel: i.actorId
          ? (actorLabels.get(i.actorId) ?? UNKNOWN_ACTOR)
          : UNKNOWN_ACTOR,
        text: i.text ?? "",
      }));

    if (rows.length === 0) return;
    await db.notification.createMany({ data: rows });
  } catch (error) {
    console.error("[notify] Benachrichtigung nicht geschrieben:", error);
  }
}
