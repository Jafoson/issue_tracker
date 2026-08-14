import "server-only";
import type {
  NotificationEvent,
  NotificationKey,
} from "@/features/account/types";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { isMailConfigured, notificationEmail, sendMail } from "@/lib/mail";
import { getMailTemplateOverride } from "@/lib/mail/overrides";
import type { TemplateOverride } from "@/lib/mail/templates/override";
import { accountPath, projectPath, workspacePath } from "@/lib/nav";

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
 *  gilt der Schema-Default (siehe `EMAIL_DEFAULT` unten für die Mail-Spalten;
 *  jede `*InApp`-Spalte ist per Default `true`). Beide Kanäle in einer
 *  Abfrage, weil sie an derselben Zeile hängen und für jede Benachrichtigung
 *  ohnehin gemeinsam gebraucht werden. */
async function notificationPrefsFor(
  userIds: string[],
): Promise<Map<string, Partial<Record<NotificationKey, boolean>>>> {
  if (userIds.length === 0) return new Map();
  const rows = await db.userPreferences.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      assignedInApp: true,
      assignedEmail: true,
      mentionedInApp: true,
      mentionedEmail: true,
      commentInApp: true,
      commentEmail: true,
      statusInApp: true,
      statusEmail: true,
      inviteInApp: true,
      inviteEmail: true,
      roleInApp: true,
      roleEmail: true,
    },
  });
  return new Map(rows.map(({ userId, ...settings }) => [userId, settings]));
}

/** Die Default-Werte der `*Email`-Spalten aus `prisma/schema.prisma` — Statuswechsel
 *  und Kommentare sind erfahrungsgemäß zu häufig fürs Postfach, alles andere
 *  ist selten genug, dass die Mail per Default an ist. */
const EMAIL_DEFAULT: Record<NotificationEvent, boolean> = {
  assigned: true,
  mentioned: true,
  comment: false,
  status: false,
  invite: true,
  role: true,
};

interface EmailContext {
  workspaceName: string;
  project: { name: string } | null;
  issue: { identifier: string; title: string } | null;
  url: string;
}

/**
 * Namen und Ziel-URL für eine Benachrichtigungsmail — gecacht je
 * Workspace/Projekt/Issue-Kombination, damit ein Stapel (etwa an Bearbeiter
 * *und* Ersteller bei einem Statuswechsel) nicht dieselben Zeilen mehrfach
 * lädt.
 */
async function emailContextFor(
  cache: Map<string, EmailContext>,
  item: Pick<NotifyInput, "workspaceId" | "projectId" | "issueId">,
): Promise<EmailContext> {
  const cacheKey = `${item.workspaceId}:${item.projectId ?? ""}:${item.issueId ?? ""}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const [workspace, project, issue] = await Promise.all([
    db.workspace.findUnique({
      where: { id: item.workspaceId },
      select: { name: true },
    }),
    item.projectId
      ? db.project.findUnique({
          where: { id: item.projectId },
          select: { name: true, slug: true, prefix: true },
        })
      : Promise.resolve(null),
    item.issueId
      ? db.issue.findUnique({
          where: { id: item.issueId },
          select: { key: true, title: true },
        })
      : Promise.resolve(null),
  ]);

  const identifier = issue && project ? `${project.prefix}-${issue.key}` : null;
  // Dieselbe Vollseiten-Route wie `features/issues/issue-links.ts#issuePath`
  // — von dort lässt sie sich nicht importieren, die Datei ist `"use client"`.
  const url =
    identifier && issue
      ? appUrl(`/${item.workspaceId}/issue/${identifier}`)
      : project
        ? appUrl(projectPath(item.workspaceId, project.slug, "members"))
        : appUrl(workspacePath(item.workspaceId, "members"));

  const context: EmailContext = {
    workspaceName: workspace?.name ?? "",
    project: project ? { name: project.name } : null,
    issue: identifier && issue ? { identifier, title: issue.title } : null,
    url,
  };
  cache.set(cacheKey, context);
  return context;
}

/** Der Admin-Override für einen Anlass, gecacht je `type` — ein Stapel
 *  derselben Art (z. B. Bearbeiter *und* Ersteller bei einem Statuswechsel)
 *  fragt `MailTemplate` sonst mehrfach für dieselbe Zeile. */
async function overrideFor(
  cache: Map<NotificationEvent, TemplateOverride | undefined>,
  type: NotificationEvent,
): Promise<TemplateOverride | undefined> {
  if (cache.has(type)) return cache.get(type);
  const override = await getMailTemplateOverride(`notification.${type}`);
  cache.set(type, override);
  return override;
}

/** Wer für seinen Anlass eine Mail sehen will, bekommt eine — unabhängig
 *  davon, ob die In-App-Zeile oben geschrieben wurde: beide Kanäle sind im
 *  Schema bewusst getrennte Spalten. */
async function sendNotificationEmails(
  items: NotifyInput[],
  prefs: Map<string, Partial<Record<NotificationKey, boolean>>>,
  actorLabels: Map<string, string>,
): Promise<void> {
  const emailKey = (type: NotificationEvent) =>
    `${type}Email` as NotificationKey;
  const recipients = items.filter(
    (i) =>
      (prefs.get(i.userId)?.[emailKey(i.type)] ?? EMAIL_DEFAULT[i.type]) ===
      true,
  );
  if (recipients.length === 0) return;

  const users = await db.user.findMany({
    where: { id: { in: [...new Set(recipients.map((i) => i.userId))] } },
    select: { id: true, email: true },
  });
  const emailFor = new Map(users.map((u) => [u.id, u.email]));

  const contextCache = new Map<string, EmailContext>();
  const overrideCache = new Map<
    NotificationEvent,
    TemplateOverride | undefined
  >();
  for (const item of recipients) {
    const to = emailFor.get(item.userId);
    if (!to) continue;

    const [context, override] = await Promise.all([
      emailContextFor(contextCache, item),
      overrideFor(overrideCache, item.type),
    ]);
    const { subject, html, text } = notificationEmail(
      {
        to,
        type: item.type,
        actorLabel: item.actorId
          ? (actorLabels.get(item.actorId) ?? UNKNOWN_ACTOR)
          : UNKNOWN_ACTOR,
        text: item.text ?? "",
        workspaceName: context.workspaceName,
        project: context.project,
        issue: context.issue,
        url: context.url,
        manageUrl: appUrl(accountPath(item.workspaceId, "notifications")),
      },
      override,
    );
    await sendMail({ to, subject, html, text });
  }
}

/**
 * Legt eine oder mehrere Benachrichtigungen an und verschickt, wer es für
 * seinen Kanal so eingestellt hat, dieselbe Nachricht per Mail.
 *
 * Selbstbenachrichtigungen werden vor beidem herausgefiltert. In-App- und
 * Mail-Kanal sind unabhängige Spalten (siehe `notificationPrefsFor`) — wer
 * beide abgeschaltet hat, bekommt konsequent nichts, ohne SMTP-Konfiguration
 * bleibt es beim In-App-Weg wie bisher.
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
      notificationPrefsFor([...new Set(items.map((i) => i.userId))]),
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

    if (rows.length > 0) {
      await db.notification.createMany({ data: rows });
    }

    if (isMailConfigured()) {
      await sendNotificationEmails(items, prefs, actorLabels);
    }
  } catch (error) {
    console.error("[notify] Benachrichtigung nicht geschrieben:", error);
  }
}
