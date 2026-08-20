"use server";

import { revalidatePath } from "next/cache";
import type { IssuePatch } from "@/features/issues/types";
import { recordAudit } from "@/lib/audit";
import type {
  LabelChangeItem,
  LabelsChangeMeta,
  StatusChangeMeta,
} from "@/lib/audit/actions";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  ISSUE_SHARE_LINK_DAYS,
  issueShareUrl,
  newIssueShareToken,
} from "@/lib/issue-share";
import { sendIssueShareLinkEmail } from "@/lib/mail";
import { notify } from "@/lib/notify";
import {
  currentUserId,
  hasPermission,
  PermissionError,
  requirePermission,
  requirePermissionOr,
} from "@/lib/permissions";
import { stripAttachmentAttrs } from "@/lib/richtext/attachments";
import { hostOf } from "@/lib/richtext/link";
import { mentionedUserIds, toPlainText, toPreview } from "@/lib/richtext/text";
import type { PMDoc } from "@/lib/richtext/types";
import { slugify } from "@/lib/slug";
import {
  deleteAttachmentObject,
  finalizeAttachmentUpload,
  type RequestAttachmentUploadResult,
  requestAttachmentUpload,
  resolveAttachmentUrl,
} from "@/lib/storage";
import { uid } from "@/lib/utils/id";
import { isValidEmail } from "@/lib/utils/parse-emails";
import { isClosedStatus } from "@/lib/workspace-defaults";
import type { IssueAttachment } from "@/types";

async function revalidate() {
  revalidatePath("/", "layout");
}

// Build a workspace-unique slug for a label (slug is unique per workspace).
async function uniqueLabelSlug(workspaceId: string, name: string) {
  const base = slugify(name) || "label";
  let slug = base;
  let n = 1;
  while (
    await db.label.findUnique({
      where: { workspaceId_slug: { workspaceId, slug } },
    })
  ) {
    slug = `${base}-${++n}`;
  }
  return slug;
}

// Lädt die für `.own`/`.any`-Prüfungen nötigen Issue-Felder — und den Status,
// an dem `closedAt` hängt (siehe `closedPatch`). Trägt außerdem, was die
// Benachrichtigungen unten brauchen (Titel, Beschreibung, Workspace/Prefix des
// Projekts), damit dafür keine zweite Abfrage nötig ist.
async function issueContext(id: string) {
  const issue = await db.issue.findUnique({
    where: { id },
    select: {
      key: true,
      projectId: true,
      reporterId: true,
      assigneeId: true,
      status: true,
      priority: true,
      type: true,
      labels: true,
      closedAt: true,
      title: true,
      description: true,
      shareToken: true,
      shareTokenExpiresAt: true,
      project: { select: { workspaceId: true, prefix: true } },
    },
  });
  if (!issue) throw new PermissionError("issue.update.any");
  return issue;
}

type IssueAuditCtx = {
  key: number;
  projectId: string;
  title: string;
  project: { workspaceId: string; prefix: string };
};

/** `MOB-1` — dieselbe Kennung wie überall sonst in der Oberfläche, statt des
 * (womöglich langen oder inzwischen geänderten) Titels. */
function issueRef(issue: { key: number; project: { prefix: string } }) {
  return `${issue.project.prefix}-${issue.key}`;
}

/**
 * Ein Protokolleintrag für ein Issue — dieselben drei Angaben (Ziel,
 * Workspace, Projekt) für jeden der grob unterschiedenen Bearbeitungs-Anlässe
 * unten, deshalb hier gebündelt statt an jeder Stelle wiederholt.
 *
 * `detail` ist bewusst optional: bei manchen Anlässen (Zuweisung entfernt,
 * Beschreibung geändert) sagt schon der Vorgang selbst genug, und das Kürzel
 * allein identifiziert das Ticket.
 *
 * Das „Grob" gilt für den Anlass (welcher Aspekt sich änderte), nicht für die
 * Beschriftung selbst: wo es einen sinnvollen alten und neuen Wert gibt (Status,
 * Priorität, Typ, Labels, Titel), steht „Alt → Neu" direkt in `targetLabel` —
 * dieselbe Auskunft, die ein Audit-Log laut gängiger Praxis geben soll, nur
 * ohne eigene Spalte dafür. Die Oberfläche (`AuditLog`/`ActivityFeed`) zerlegt
 * „Kürzel: Alt → Neu" beim Anzeigen wieder in seine Teile. `meta` trägt
 * dieselben Werte zusätzlich roh (nicht in der Liste sichtbar, aber in der
 * Datenbank nachvollziehbar).
 */
async function recordIssueAudit(
  action:
    | "issue.created"
    | "issue.deleted"
    | "issue.assigned"
    | "issue.unassigned"
    | "issue.title.changed"
    | "issue.description.changed"
    | "issue.status.changed"
    | "issue.priority.changed"
    | "issue.type.changed"
    | "issue.labels.changed"
    | "issue.shared"
    | "issue.share.revoked",
  id: string,
  issue: { projectId: string; project: { workspaceId: string } } & Parameters<
    typeof issueRef
  >[0],
  actorId: string,
  detail?: string,
  meta?: object,
  /** Kontofarbe der/des Zugewiesenen, für den Avatar neben ihrem Namen in
   * `detail` — das Ziel selbst ist das Issue, nicht sie. */
  personColor?: string | null,
) {
  const ref = issueRef(issue);
  await recordAudit({
    action,
    actorId,
    target: { type: "issue", id, label: detail ? `${ref}: ${detail}` : ref },
    workspaceId: issue.project.workspaceId,
    projectId: issue.projectId,
    ...(meta !== undefined ? { meta: meta as Prisma.InputJsonValue } : {}),
    ...(personColor !== undefined ? { personColor } : {}),
  });
}

/** Name und Farbe eines Status — die Farbe geht mit ins Protokoll (eingefroren,
 * wie `actorColor`), damit `StatusIcon` sie zeigen kann, ohne den Katalog zum
 * Lesezeitpunkt erneut zu befragen. */
async function statusInfo(
  id: string,
): Promise<{ name: string; color: string } | null> {
  return db.status.findUnique({
    where: { id },
    select: { name: true, color: true },
  });
}

async function priorityName(id: number): Promise<string | null> {
  return (
    (await db.priority.findUnique({ where: { id }, select: { name: true } }))
      ?.name ?? null
  );
}

async function issueTypeName(id: string): Promise<string | null> {
  return (
    (await db.issueType.findUnique({ where: { id }, select: { name: true } }))
      ?.name ?? null
  );
}

/** Statuswechsel protokollieren — geteilt von `moveIssue`, `reorderIssue` und `updateIssue`. */
async function recordStatusChangeAudit(
  id: string,
  issue: IssueAuditCtx,
  actorId: string,
  from: string,
  to: string,
) {
  const [fromInfo, toInfo] = await Promise.all([
    statusInfo(from),
    statusInfo(to),
  ]);
  const meta: StatusChangeMeta = {
    from,
    to,
    fromColor: fromInfo?.color ?? null,
    toColor: toInfo?.color ?? null,
  };
  await recordIssueAudit(
    "issue.status.changed",
    id,
    issue,
    actorId,
    `${fromInfo?.name ?? from} → ${toInfo?.name ?? to}`,
    meta,
  );
}

/** Welche Labels dazukamen und welche weg sind — nicht nur „etwas hat sich geändert". */
async function recordLabelsChangeAudit(
  id: string,
  issue: IssueAuditCtx,
  actorId: string,
  before: string[],
  after: string[],
) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added = after.filter((labelId) => !beforeSet.has(labelId));
  const removed = before.filter((labelId) => !afterSet.has(labelId));
  if (added.length === 0 && removed.length === 0) return;

  const rows = await db.label.findMany({
    where: { id: { in: [...added, ...removed] } },
    select: { id: true, name: true, color: true },
  });
  const itemFor = (labelId: string): LabelChangeItem =>
    rows.find((r) => r.id === labelId) ?? {
      id: labelId,
      name: labelId,
      color: "#8a9099",
    };
  const parts = [
    added.length > 0
      ? `+ ${added.map((l) => itemFor(l).name).join(", ")}`
      : null,
    removed.length > 0
      ? `− ${removed.map((l) => itemFor(l).name).join(", ")}`
      : null,
  ].filter((p): p is string => p !== null);
  const meta: LabelsChangeMeta = {
    added: added.map(itemFor),
    removed: removed.map(itemFor),
  };

  await recordIssueAudit(
    "issue.labels.changed",
    id,
    issue,
    actorId,
    parts.join(" / "),
    meta,
  );
}

/**
 * Benachrichtigt Bearbeiter und Ersteller über einen Statuswechsel — aus
 * `moveIssue`, `reorderIssue` und `updateIssue` gleichermaßen aufgerufen, denn
 * ein Statuswechsel per Drag&Drop ist derselbe Anlass wie einer aus dem Panel.
 */
async function notifyStatusChange(
  issueId: string,
  issue: {
    projectId: string;
    status: string;
    assigneeId: string | null;
    reporterId: string;
    project: { workspaceId: string };
  },
  actorId: string,
  nextStatus: string,
): Promise<void> {
  if (nextStatus === issue.status) return;
  const recipients = [...new Set([issue.assigneeId, issue.reporterId])].filter(
    (userId): userId is string => !!userId && userId !== actorId,
  );
  if (recipients.length === 0) return;
  await notify(
    recipients.map((userId) => ({
      userId,
      type: "status" as const,
      actorId,
      workspaceId: issue.project.workspaceId,
      projectId: issue.projectId,
      issueId,
      text: nextStatus,
    })),
  );
}

/** Wer neu in einem Dokument erwähnt wurde, minus dem, der es geschrieben hat. */
async function notifyMentions(
  ids: string[],
  ctx: {
    workspaceId: string;
    projectId: string;
    issueId: string;
    text: string;
  },
  actorId: string,
): Promise<void> {
  const recipients = ids.filter((userId) => userId !== actorId);
  if (recipients.length === 0) return;
  await notify(
    recipients.map((userId) => ({
      userId,
      type: "mentioned" as const,
      actorId,
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId,
      issueId: ctx.issueId,
      text: ctx.text,
    })),
  );
}

/**
 * Was am Abschlussdatum zu ändern ist, wenn der Status auf `next` wechselt.
 *
 * Drei Fälle, und der dritte ist der Grund für diese Funktion: wer eine
 * abgeschlossene Aufgabe wieder aufmacht, muss das Datum verlieren — sonst zählt
 * das Dashboard sie weiter zum Durchsatz jenes Tages, an dem sie einmal fertig
 * war. Und wer sie von „Done" nach „Canceled" schiebt, behält das ursprüngliche
 * Datum: geschlossen wurde sie damals, umbenannt wurde nur, wie.
 *
 * Ein leeres Objekt heißt „nichts anzufassen" und lässt sich unverändert in
 * `data` spreaden.
 */
function closedPatch(
  before: { status: string; closedAt: Date | null },
  next: string | undefined,
): { closedAt?: Date | null } {
  if (next === undefined || next === before.status) return {};

  if (isClosedStatus(next)) {
    // Schon ein Datum? Dann bleibt es stehen — siehe „Done" → „Canceled".
    return before.closedAt ? {} : { closedAt: new Date() };
  }
  return before.closedAt ? { closedAt: null } : {};
}

export async function moveIssue(id: string, status: string) {
  const issue = await issueContext(id);
  const actorId = await requirePermissionOr([
    {
      permission: "issue.update.any",
      ctx: { projectId: issue.projectId },
    },
    {
      permission: "issue.update.own",
      ctx: { projectId: issue.projectId },
      ownerIds: [issue.reporterId, issue.assigneeId],
    },
  ]);
  await db.issue.update({
    where: { id },
    data: { status, ...closedPatch(issue, status) },
  });
  await notifyStatusChange(id, issue, actorId, status);
  if (status !== issue.status) {
    await recordStatusChangeAudit(id, issue, actorId, issue.status, status);
  }
  await revalidate();
}

export async function reorderIssue(id: string, status: string, rank: number) {
  const issue = await issueContext(id);
  const actorId = await requirePermissionOr([
    {
      permission: "issue.update.any",
      ctx: { projectId: issue.projectId },
    },
    {
      permission: "issue.update.own",
      ctx: { projectId: issue.projectId },
      ownerIds: [issue.reporterId, issue.assigneeId],
    },
  ]);
  await db.issue.update({
    where: { id },
    data: { status, rank, ...closedPatch(issue, status) },
  });
  await notifyStatusChange(id, issue, actorId, status);
  if (status !== issue.status) {
    await recordStatusChangeAudit(id, issue, actorId, issue.status, status);
  }
  await revalidate();
}

export async function updateIssue(id: string, patch: IssuePatch) {
  const issue = await issueContext(id);
  const ctx = { projectId: issue.projectId };
  const actorId = await requirePermissionOr([
    { permission: "issue.update.any", ctx },
    {
      permission: "issue.update.own",
      ctx,
      ownerIds: [issue.reporterId, issue.assigneeId],
    },
  ]);
  // Das (Neu-)Zuweisen eines Issues erfordert zusätzlich die Assign-Permission.
  if (patch.assignee !== undefined) {
    await requirePermission("issue.assign", ctx);
  }

  await db.issue.update({
    where: { id },
    data: {
      ...(patch.status !== undefined && { status: patch.status }),
      ...closedPatch(issue, patch.status),
      ...(patch.priority !== undefined && { priority: patch.priority }),
      ...(patch.type !== undefined && { type: patch.type }),
      ...(patch.assignee !== undefined && { assigneeId: patch.assignee }),
      ...(patch.labels !== undefined && { labels: patch.labels }),
      ...(patch.title !== undefined && { title: patch.title }),
      // Dokument und abgeleiteter Fließtext gehören zusammen — die Suche
      // liefe sonst gegen einen veralteten Stand. `stripAttachmentAttrs`
      // wirft die nur zur Anzeige angereicherten Anhang-Attribute (url,
      // name, mimeType, size) wieder ab — sonst landete eine presignte URL,
      // die nach einer Stunde abläuft, dauerhaft in der Spalte.
      ...(patch.description !== undefined && {
        description: stripAttachmentAttrs(
          patch.description,
        ) as unknown as Prisma.InputJsonValue,
        descriptionText: toPlainText(patch.description),
      }),
    },
  });

  if (
    patch.assignee &&
    patch.assignee !== issue.assigneeId &&
    patch.assignee !== actorId
  ) {
    await notify({
      userId: patch.assignee,
      type: "assigned",
      actorId,
      workspaceId: issue.project.workspaceId,
      projectId: issue.projectId,
      issueId: id,
    });
  }

  if (patch.status !== undefined) {
    await notifyStatusChange(id, issue, actorId, patch.status);
  }

  if (patch.description !== undefined) {
    const before = new Set(mentionedUserIds(issue.description));
    const newlyMentioned = mentionedUserIds(patch.description).filter(
      (userId) => !before.has(userId),
    );
    await notifyMentions(
      newlyMentioned,
      {
        workspaceId: issue.project.workspaceId,
        projectId: issue.projectId,
        issueId: id,
        text: toPreview(patch.description),
      },
      actorId,
    );
  }

  // ── Grob protokollieren, was sich geändert hat ──
  //
  // Ein Eintrag je geändertem Aspekt, nicht ein Feld-für-Feld-Diff: „Titel
  // geändert" sagt genug, der alte Text gehört nicht ins Protokoll. Jeder
  // Vergleich läuft gegen den Stand von `issue` (vor diesem Patch) — ein
  // erneutes Speichern desselben Werts (Picker ohne echte Änderung) erzeugt
  // damit keine Zeile.
  if (patch.assignee !== undefined && patch.assignee !== issue.assigneeId) {
    if (patch.assignee) {
      const [assignee, previous] = await Promise.all([
        db.user.findUnique({
          where: { id: patch.assignee },
          select: { firstName: true, lastName: true, color: true },
        }),
        // Wer die Aufgabe vorher hatte — steht mit in der Zeile, sonst sähe
        // eine Umverteilung wie eine Erstzuweisung aus.
        issue.assigneeId
          ? db.user.findUnique({
              where: { id: issue.assigneeId },
              select: { firstName: true, lastName: true },
            })
          : null,
      ]);
      const assigneeName = assignee
        ? `${assignee.firstName} ${assignee.lastName}`.trim()
        : patch.assignee;
      const previousName = previous
        ? `${previous.firstName} ${previous.lastName}`.trim()
        : null;
      await recordIssueAudit(
        "issue.assigned",
        id,
        issue,
        actorId,
        previousName ? `${previousName} → ${assigneeName}` : assigneeName,
        undefined,
        assignee?.color ?? null,
      );
    } else {
      await recordIssueAudit("issue.unassigned", id, issue, actorId);
    }
  }

  if (patch.title !== undefined && patch.title !== issue.title) {
    await recordIssueAudit(
      "issue.title.changed",
      id,
      issue,
      actorId,
      `${issue.title} → ${patch.title}`,
    );
  }

  if (
    patch.description !== undefined &&
    JSON.stringify(patch.description) !== JSON.stringify(issue.description)
  ) {
    await recordIssueAudit("issue.description.changed", id, issue, actorId);
  }

  if (patch.status !== undefined && patch.status !== issue.status) {
    await recordStatusChangeAudit(
      id,
      issue,
      actorId,
      issue.status,
      patch.status,
    );
  }

  if (patch.priority !== undefined && patch.priority !== issue.priority) {
    const [fromName, toName] = await Promise.all([
      priorityName(issue.priority),
      priorityName(patch.priority),
    ]);
    await recordIssueAudit(
      "issue.priority.changed",
      id,
      issue,
      actorId,
      `${fromName ?? issue.priority} → ${toName ?? patch.priority}`,
      { from: issue.priority, to: patch.priority },
    );
  }

  if (patch.type !== undefined && patch.type !== issue.type) {
    const [fromName, toName] = await Promise.all([
      issueTypeName(issue.type),
      issueTypeName(patch.type),
    ]);
    await recordIssueAudit(
      "issue.type.changed",
      id,
      issue,
      actorId,
      `${fromName ?? issue.type} → ${toName ?? patch.type}`,
      { from: issue.type, to: patch.type },
    );
  }

  if (patch.labels !== undefined) {
    await recordLabelsChangeAudit(
      id,
      issue,
      actorId,
      issue.labels,
      patch.labels,
    );
  }

  await revalidate();
}

// ── Anhänge ──────────────────────────────────────────────────────────────────
//
// Dieselbe Berechtigung wie beim Bearbeiten der Beschreibung selbst
// (`issue.update.any`/`.own`) — ein Anhang ist Teil der Beschreibung, keine
// eigene Permission nötig.

async function requireAttachmentAccess(issueId: string) {
  const issue = await issueContext(issueId);
  const actorId = await requirePermissionOr([
    { permission: "issue.update.any", ctx: { projectId: issue.projectId } },
    {
      permission: "issue.update.own",
      ctx: { projectId: issue.projectId },
      ownerIds: [issue.reporterId, issue.assigneeId],
    },
  ]);
  return actorId;
}

export async function requestIssueAttachmentUpload(
  issueId: string,
  input: { fileName: string; contentType: string; contentLength: number },
): Promise<RequestAttachmentUploadResult> {
  await requireAttachmentAccess(issueId);
  return requestAttachmentUpload({ issueId, ...input });
}

export async function confirmIssueAttachmentUpload(
  issueId: string,
  key: string,
  input: { fileName: string; contentType: string },
): Promise<{ ok: true; attachment: IssueAttachment } | { error: string }> {
  const actorId = await requireAttachmentAccess(issueId);

  const finalized = await finalizeAttachmentUpload(issueId, key);
  if ("error" in finalized) return finalized;

  const row = await db.attachment.create({
    data: {
      id: uid("att"),
      issueId,
      authorId: actorId,
      kind: "file",
      name: input.fileName,
      key,
      mimeType: input.contentType,
      size: finalized.size,
    },
  });

  await revalidate();
  return {
    ok: true,
    attachment: {
      id: row.id,
      kind: "file",
      name: row.name,
      url: await resolveAttachmentUrl(row.key),
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.created.getTime(),
      authorId: row.authorId,
    },
  };
}

/** Nur `http(s)://` — dieselbe Zurückhaltung wie bei jeder anderen Adresse,
 *  die in ein `href` wandert (siehe `lib/richtext/link.ts`). */
function isWebUrl(href: string): boolean {
  try {
    return /^https?:$/i.test(new URL(href).protocol);
  } catch {
    return false;
  }
}

export async function addIssueLinkAttachment(
  issueId: string,
  input: { url: string; name?: string },
): Promise<{ ok: true; attachment: IssueAttachment } | { error: string }> {
  const actorId = await requireAttachmentAccess(issueId);

  const href = input.url.trim();
  if (!isWebUrl(href)) return { error: "Only http(s) links are allowed." };

  const row = await db.attachment.create({
    data: {
      id: uid("att"),
      issueId,
      authorId: actorId,
      kind: "link",
      name: input.name?.trim() || hostOf(href),
      url: href,
    },
  });

  await revalidate();
  return {
    ok: true,
    attachment: {
      id: row.id,
      kind: "link",
      name: row.name,
      url: row.url,
      mimeType: null,
      size: null,
      createdAt: row.created.getTime(),
      authorId: row.authorId,
    },
  };
}

export async function deleteIssueAttachment(
  issueId: string,
  attachmentId: string,
): Promise<{ ok: true } | { error: string }> {
  await requireAttachmentAccess(issueId);

  const row = await db.attachment.findUnique({ where: { id: attachmentId } });
  if (!row || row.issueId !== issueId) return { error: "Not found." };

  await db.attachment.delete({ where: { id: attachmentId } });
  if (row.kind === "file") await deleteAttachmentObject(row.key);

  await revalidate();
  return { ok: true };
}

export async function createIssue(data: {
  title: string;
  description: PMDoc;
  status: string;
  priority: number;
  assignee: string | null;
  labels: string[];
  type: string;
  projectId: string;
  reporterId: string;
}) {
  // Reporter ist immer der eingeloggte User — nicht der Client-Parameter.
  const userId = await requirePermission("issue.create", {
    projectId: data.projectId,
  });

  // Atomically claim the next key for this project. The counter only ever
  // increments, so deleted keys are never reused and each key stays unique.
  const { lastIssueKey, workspaceId, prefix } = await db.project.update({
    where: { id: data.projectId },
    data: { lastIssueKey: { increment: 1 } },
    select: { lastIssueKey: true, workspaceId: true, prefix: true },
  });
  const id = uid("i");
  await db.issue.create({
    data: {
      id,
      key: lastIssueKey,
      title: data.title,
      description: stripAttachmentAttrs(
        data.description,
      ) as unknown as Prisma.InputJsonValue,
      descriptionText: toPlainText(data.description),
      status: data.status,
      // Wer eine Aufgabe gleich als erledigt anlegt — nachgetragene Arbeit —
      // hat sie in derselben Sekunde geschlossen.
      ...(isClosedStatus(data.status) ? { closedAt: new Date() } : {}),
      priority: data.priority,
      assigneeId: data.assignee,
      labels: data.labels,
      type: data.type,
      projectId: data.projectId,
      reporterId: userId,
      rank: Date.now(),
    },
  });

  if (data.assignee && data.assignee !== userId) {
    await notify({
      userId: data.assignee,
      type: "assigned",
      actorId: userId,
      workspaceId,
      projectId: data.projectId,
      issueId: id,
    });
  }

  await notifyMentions(
    mentionedUserIds(data.description),
    {
      workspaceId,
      projectId: data.projectId,
      issueId: id,
      text: toPreview(data.description),
    },
    userId,
  );

  await recordIssueAudit(
    "issue.created",
    id,
    {
      key: lastIssueKey,
      projectId: data.projectId,
      project: { workspaceId, prefix },
    },
    userId,
    data.title,
  );

  await revalidate();
}

export async function createLabel(data: {
  name: string;
  color: string;
  workspaceId: string;
  projectId?: string | null;
}) {
  // Ein Projekt-Label gehört zwei Eltern: dem Projekt und dessen Workspace. Der
  // Workspace kommt deshalb aus dem Projekt und nicht aus dem Aufruf — geprüft
  // wird im Projekt-Kontext, geschrieben würde sonst woanders. Ein Aufruf mit
  // fremder `workspaceId` legt damit kein Label im fremden Mandanten mehr an.
  let workspaceId = data.workspaceId;
  let actorId: string;

  if (data.projectId) {
    const project = await db.project.findUnique({
      where: { id: data.projectId },
      select: { workspaceId: true },
    });
    if (!project) throw new PermissionError("label.create");
    workspaceId = project.workspaceId;

    actorId = await requirePermission("label.create", {
      projectId: data.projectId,
    });
  } else {
    actorId = await requirePermission("label.create", { workspaceId });
  }

  const slug = await uniqueLabelSlug(workspaceId, data.name);
  const label = await db.label.create({
    data: {
      id: uid("l"),
      name: data.name,
      slug,
      color: data.color,
      workspace: { connect: { id: workspaceId } },
      ...(data.projectId
        ? { project: { connect: { id: data.projectId } } }
        : {}),
    },
  });

  await recordAudit({
    action: "label.created",
    actorId,
    target: { type: "label", id: label.id, label: label.name },
    workspaceId,
    projectId: data.projectId ?? null,
  });

  await revalidate();
  return {
    id: label.id,
    name: label.name,
    slug: label.slug,
    color: label.color,
    projectId: label.projectId,
  };
}

/**
 * Anders als `createLabel` werfen Ändern und Löschen nicht, sondern melden den
 * Grund zurück — sie werden von der Verwaltungsseite aufgerufen, und die zeigt
 * den Satz an, statt in eine Fehlergrenze zu laufen.
 */
type LabelResult = { ok: true } | { error: string };

/**
 * In welchem Scope über ein Label entschieden wird.
 *
 * Ein Projekt-Label gehört seinem Projekt, ein Label ohne `projectId` dem
 * ganzen Workspace. Derselbe Permission-Key, zwei Ebenen — genau die
 * Unterscheidung, für die `WORKSPACE_AND_PROJECT` in der Registry steht. Ein
 * Workspace-Label lässt sich deshalb nicht aus den Einstellungen eines
 * einzelnen Projekts heraus ändern: es gilt auch in allen anderen.
 */
async function labelScope(labelId: string) {
  const label = await db.label.findUnique({
    where: { id: labelId },
    select: { id: true, name: true, workspaceId: true, projectId: true },
  });
  if (!label) return null;

  return {
    label,
    ctx: label.projectId
      ? ({ projectId: label.projectId } as const)
      : ({ workspaceId: label.workspaceId } as const),
  };
}

/**
 * Namen und Farbe eines Labels ändern.
 *
 * Der Slug bleibt, wie er ist. Er steht in gespeicherten Filtern und in den
 * URLs offener Reiter (`?label=…`) — ein Umbenennen soll die nicht ins Leere
 * laufen lassen. Wer wirklich einen neuen Slug braucht, legt ein neues Label an.
 */
export async function updateLabel(
  labelId: string,
  data: { name?: string; color?: string },
): Promise<LabelResult> {
  const scoped = await labelScope(labelId);
  if (!scoped) return { error: "This label no longer exists." };

  if (!(await hasPermission("label.update", scoped.ctx)))
    return { error: "You are not allowed to edit this label." };

  const name = data.name?.trim();
  if (name !== undefined && !name) return { error: "Name is required." };

  await db.label.update({
    where: { id: labelId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
    },
  });
  await revalidate();
  return { ok: true };
}

/**
 * Label löschen und aus allen Issues nehmen, an denen es hängt.
 *
 * `Issue.labels` ist ein Array aus IDs ohne Fremdschlüssel — die Datenbank
 * räumt hier nichts hinterher. Ohne den zweiten Schritt bliebe in jedem
 * betroffenen Issue eine ID stehen, die auf nichts mehr zeigt: die Anzeige
 * verschwiegen sie stillschweigend, die Filter aber zählten sie mit.
 *
 * Beides in einer Transaktion, damit es kein Dazwischen gibt, in dem das Label
 * schon weg und die Verweise noch da sind.
 */
export async function deleteLabel(labelId: string): Promise<LabelResult> {
  const scoped = await labelScope(labelId);
  if (!scoped) return { error: "This label no longer exists." };

  if (!(await hasPermission("label.delete", scoped.ctx)))
    return { error: "You are not allowed to delete this label." };

  const tagged = await db.issue.findMany({
    where: { labels: { has: labelId } },
    select: { id: true, labels: true },
  });

  await db.$transaction([
    ...tagged.map((issue) =>
      db.issue.update({
        where: { id: issue.id },
        data: { labels: issue.labels.filter((id) => id !== labelId) },
      }),
    ),
    db.label.delete({ where: { id: labelId } }),
  ]);

  await recordAudit({
    action: "label.deleted",
    actorId: await currentUserId(),
    target: { type: "label", id: labelId, label: scoped.label.name },
    workspaceId: scoped.label.workspaceId,
    projectId: scoped.label.projectId,
  });

  await revalidate();
  return { ok: true };
}

/**
 * Ein Workspace-Label in einem Projekt aus- oder wieder einblenden.
 *
 * Der Gegenentwurf zum Löschen: das Label bleibt, wo es hingehört, und gilt in
 * allen anderen Projekten weiter — nur hier wird es nicht mehr angeboten. Damit
 * lässt sich eine workspaceweite Sammlung nutzen, ohne dass jedes Projekt jedes
 * Label mitschleppt.
 *
 * Entschieden wird im Projekt-Scope über `label.update`: es ist eine Aussage
 * über dieses Projekt, nicht über das Label. Wer im Workspace nichts darf, darf
 * hier trotzdem aufräumen — und ändert dabei für die anderen nichts.
 *
 * Für Projekt-Labels ist der Aufruf sinnlos und wird abgelehnt: sie gelten
 * ohnehin nur hier, ausblenden hieße löschen. Das Label an Aufgaben, die es
 * schon tragen, bleibt in beiden Richtungen unangetastet.
 */
export async function setLabelHidden(
  projectId: string,
  labelId: string,
  hidden: boolean,
): Promise<LabelResult> {
  const label = await db.label.findUnique({
    where: { id: labelId },
    select: { workspaceId: true, projectId: true },
  });
  if (!label) return { error: "This label no longer exists." };
  if (label.projectId)
    return { error: "Only workspace labels can be hidden in a project." };

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  // Ein Label aus einem fremden Mandanten hat in diesem Projekt nichts zu
  // suchen — auch nicht als ausgeblendete Zeile.
  if (!project || project.workspaceId !== label.workspaceId)
    return { error: "This label does not belong to this project." };

  if (!(await hasPermission("label.update", { projectId })))
    return { error: "You are not allowed to change the labels here." };

  // Beide Richtungen vertragen einen zweiten Aufruf: zwei Klicks auf denselben
  // Umschalter sollen keinen Fehler ergeben, sondern denselben Zustand.
  if (hidden) {
    await db.projectHiddenLabel.upsert({
      where: { projectId_labelId: { projectId, labelId } },
      create: { projectId, labelId },
      update: {},
    });
  } else {
    await db.projectHiddenLabel.deleteMany({ where: { projectId, labelId } });
  }

  await revalidate();
  return { ok: true };
}

export async function deleteIssue(id: string) {
  const issue = await issueContext(id);
  const actorId = await requirePermissionOr([
    {
      permission: "issue.delete.any",
      ctx: { projectId: issue.projectId },
    },
    {
      permission: "issue.delete.own",
      ctx: { projectId: issue.projectId },
      ownerIds: [issue.reporterId, issue.assigneeId],
    },
  ]);
  await db.issue.delete({ where: { id } });

  await recordIssueAudit("issue.deleted", id, issue, actorId, issue.title);

  await revalidate();
}

/** Neuer Token + die Metadaten, die `/share/[token]` über den aktuellen Link
 *  anzeigt (wer, wann, bis wann) — an einer Stelle, damit `enableIssueShare`
 *  und das stille Einschalten aus `shareIssueByEmail` nicht auseinanderlaufen. */
function newShareTokenData(actorId: string, now: Date) {
  return {
    shareToken: newIssueShareToken(),
    shareTokenCreatedAt: now,
    shareTokenCreatedById: actorId,
    shareTokenExpiresAt: new Date(
      now.getTime() + ISSUE_SHARE_LINK_DAYS * 24 * 60 * 60 * 1000,
    ),
  };
}

/**
 * Schaltet den öffentlichen Lese-Link eines Issues ein und erzeugt (oder
 * erneuert) den Token. Wer den Link kennt, sieht Titel, Beschreibung, Status/
 * Priorität/Typ/Labels und Kommentare — nichts, was `issue.share.manage`
 * nicht selbst schon sehen darf, nur eben ohne Login (`/share/[token]`).
 */
export async function enableIssueShare(
  id: string,
): Promise<{ ok: true; url: string }> {
  const issue = await issueContext(id);
  const actorId = await requirePermission("issue.share.manage", {
    projectId: issue.projectId,
  });

  const data = newShareTokenData(actorId, new Date());
  await db.issue.update({ where: { id }, data });

  await recordIssueAudit("issue.shared", id, issue, actorId);

  await revalidate();
  return { ok: true, url: issueShareUrl(data.shareToken) };
}

/** Schaltet den öffentlichen Lese-Link wieder aus — der alte Token wird ungültig. */
export async function disableIssueShare(id: string): Promise<{ ok: true }> {
  const issue = await issueContext(id);
  const actorId = await requirePermission("issue.share.manage", {
    projectId: issue.projectId,
  });

  await db.issue.update({
    where: { id },
    data: {
      shareToken: null,
      shareTokenCreatedAt: null,
      shareTokenExpiresAt: null,
      shareTokenCreatedById: null,
    },
  });

  await recordIssueAudit("issue.share.revoked", id, issue, actorId);

  await revalidate();
  return { ok: true };
}

/**
 * Benachrichtigt ein Workspace-Mitglied über dieses Issue — in-app und, wenn
 * die Person es so eingestellt hat, per Mail (`lib/notify`, Anlass
 * "issueShared"). Anders als der öffentliche Link braucht es dafür keinen
 * Token: die Person sieht das Issue über ihre eigene, ganz normale
 * Berechtigung, genau wie bei einer Erwähnung — fehlt ihr die, läuft sie beim
 * Öffnen in dieselbe Zugriffsschranke wie bei jeder anderen Erwähnung auch.
 */
export async function shareIssueWithMember(
  id: string,
  userId: string,
  message?: string,
): Promise<{ ok: true }> {
  const issue = await issueContext(id);
  const actorId = await requirePermission("issue.share.manage", {
    projectId: issue.projectId,
  });

  await notify({
    userId,
    type: "issueShared",
    actorId,
    workspaceId: issue.project.workspaceId,
    projectId: issue.projectId,
    issueId: id,
    text: message?.trim() ?? "",
  });

  return { ok: true };
}

/**
 * Verschickt den öffentlichen Lese-Link per Mail an eine beliebige Adresse —
 * anders als `shareIssueWithMember` kein Konto im System, deshalb über den
 * `/share/[token]`-Weg statt der internen Issue-Seite. Ist das Teilen noch
 * aus, schaltet der Versand es gleich mit ein (derselbe Token wie beim
 * expliziten "Link erstellen") — eine Mail mit einem toten Link wäre sinnlos.
 */
export async function shareIssueByEmail(
  id: string,
  email: string,
  message?: string,
): Promise<{ ok: true; url: string } | { error: string }> {
  const issue = await issueContext(id);
  const actorId = await requirePermission("issue.share.manage", {
    projectId: issue.projectId,
  });

  const to = email.trim().toLowerCase();
  if (!isValidEmail(to)) return { error: "invalid-email" };

  const now = new Date();
  let token: string;
  if (
    issue.shareToken &&
    (!issue.shareTokenExpiresAt || issue.shareTokenExpiresAt > now)
  ) {
    token = issue.shareToken;
  } else {
    const data = newShareTokenData(actorId, now);
    token = data.shareToken;
    await db.issue.update({ where: { id }, data });
    await recordIssueAudit("issue.shared", id, issue, actorId);
    await revalidate();
  }

  const url = issueShareUrl(token);

  await sendIssueShareLinkEmail({
    to,
    actorId,
    issueIdentifier: `${issue.project.prefix}-${issue.key}`,
    issueTitle: issue.title,
    text: message?.trim() || undefined,
    url,
  });

  return { ok: true, url };
}

export async function addComment(
  issueId: string,
  body: PMDoc,
  _authorId: string,
) {
  const issue = await db.issue.findUnique({
    where: { id: issueId },
    select: {
      projectId: true,
      assigneeId: true,
      reporterId: true,
      project: { select: { workspaceId: true } },
    },
  });
  if (!issue) throw new PermissionError("comment.create");
  // Autor ist immer der eingeloggte User — der Parameter wird ignoriert.
  const userId = await requirePermission("comment.create", {
    projectId: issue.projectId,
  });

  await db.comment.create({
    data: {
      id: uid("c"),
      body: body as unknown as Prisma.InputJsonValue,
      bodyText: toPlainText(body),
      issueId,
      authorId: userId,
    },
  });

  const text = toPreview(body);
  const mentionedIds = mentionedUserIds(body).filter((id) => id !== userId);
  await notifyMentions(
    mentionedIds,
    {
      workspaceId: issue.project.workspaceId,
      projectId: issue.projectId,
      issueId,
      text,
    },
    userId,
  );

  // Wer explizit erwähnt wurde, bekommt nur die genauere "mentioned"-
  // Benachrichtigung, nicht zusätzlich die generische "comment" für dieselbe
  // Zeile.
  const mentioned = new Set(mentionedIds);
  const commentRecipients = [
    ...new Set([issue.assigneeId, issue.reporterId]),
  ].filter((id): id is string => !!id && id !== userId && !mentioned.has(id));
  if (commentRecipients.length > 0) {
    await notify(
      commentRecipients.map((recipientId) => ({
        userId: recipientId,
        type: "comment" as const,
        actorId: userId,
        workspaceId: issue.project.workspaceId,
        projectId: issue.projectId,
        issueId,
        text,
      })),
    );
  }

  await revalidate();
}

export async function deleteComment(commentId: string) {
  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true, issue: { select: { projectId: true } } },
  });
  if (!comment) throw new PermissionError("comment.delete.any");
  const ctx = { projectId: comment.issue.projectId };
  await requirePermissionOr([
    { permission: "comment.delete.any", ctx },
    {
      permission: "comment.delete.own",
      ctx,
      ownerIds: [comment.authorId],
    },
  ]);
  await db.comment.delete({ where: { id: commentId } });
  await revalidate();
}
