"use server";

import { revalidatePath } from "next/cache";
import type { IssuePatch } from "@/features/issues/types";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { notify } from "@/lib/notify";
import {
  hasPermission,
  PermissionError,
  requirePermission,
  requirePermissionOr,
} from "@/lib/permissions";
import { mentionedUserIds, toPlainText, toPreview } from "@/lib/richtext/text";
import type { PMDoc } from "@/lib/richtext/types";
import { slugify } from "@/lib/slug";
import { uid } from "@/lib/utils/id";
import { isClosedStatus } from "@/lib/workspace-defaults";

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
      projectId: true,
      reporterId: true,
      assigneeId: true,
      status: true,
      closedAt: true,
      title: true,
      description: true,
      project: { select: { workspaceId: true } },
    },
  });
  if (!issue) throw new PermissionError("issue.update.any");
  return issue;
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
      // liefe sonst gegen einen veralteten Stand.
      ...(patch.description !== undefined && {
        description: patch.description as unknown as Prisma.InputJsonValue,
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

  await revalidate();
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
  const { lastIssueKey, workspaceId } = await db.project.update({
    where: { id: data.projectId },
    data: { lastIssueKey: { increment: 1 } },
    select: { lastIssueKey: true, workspaceId: true },
  });
  const id = uid("i");
  await db.issue.create({
    data: {
      id,
      key: lastIssueKey,
      title: data.title,
      description: data.description as unknown as Prisma.InputJsonValue,
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

  if (data.projectId) {
    const project = await db.project.findUnique({
      where: { id: data.projectId },
      select: { workspaceId: true },
    });
    if (!project) throw new PermissionError("label.create");
    workspaceId = project.workspaceId;

    await requirePermission("label.create", { projectId: data.projectId });
  } else {
    await requirePermission("label.create", { workspaceId });
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
    select: { id: true, workspaceId: true, projectId: true },
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
  await requirePermissionOr([
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
  await revalidate();
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
