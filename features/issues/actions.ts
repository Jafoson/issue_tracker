"use server";

import { revalidatePath } from "next/cache";
import type { IssuePatch } from "@/features/issues/types";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  accessFor,
  PermissionError,
  requirePermission,
  requirePermissionOr,
} from "@/lib/permissions";
import { OWNER_ROLE_KEY } from "@/lib/rbac";
import { toPlainText } from "@/lib/richtext/text";
import type { PMDoc } from "@/lib/richtext/types";
import { slugify } from "@/lib/slug";
import { uid } from "@/lib/utils/id";

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

// Lädt die für `.own`/`.any`-Prüfungen nötigen Issue-Felder.
async function issueContext(id: string) {
  const issue = await db.issue.findUnique({
    where: { id },
    select: { projectId: true, reporterId: true, assigneeId: true },
  });
  if (!issue) throw new PermissionError("issue.update.any");
  return issue;
}

export async function moveIssue(id: string, status: string) {
  const issue = await issueContext(id);
  await requirePermissionOr([
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
  await db.issue.update({ where: { id }, data: { status } });
  await revalidate();
}

export async function reorderIssue(id: string, status: string, rank: number) {
  const issue = await issueContext(id);
  await requirePermissionOr([
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
  await db.issue.update({ where: { id }, data: { status, rank } });
  await revalidate();
}

export async function updateIssue(id: string, patch: IssuePatch) {
  const issue = await issueContext(id);
  const ctx = { projectId: issue.projectId };
  await requirePermissionOr([
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
  const { lastIssueKey } = await db.project.update({
    where: { id: data.projectId },
    data: { lastIssueKey: { increment: 1 } },
    select: { lastIssueKey: true },
  });
  await db.issue.create({
    data: {
      id: uid("i"),
      key: lastIssueKey,
      title: data.title,
      description: data.description as unknown as Prisma.InputJsonValue,
      descriptionText: toPlainText(data.description),
      status: data.status,
      priority: data.priority,
      assigneeId: data.assignee,
      labels: data.labels,
      type: data.type,
      projectId: data.projectId,
      reporterId: userId,
      rank: Date.now(),
    },
  });
  await revalidate();
}

export async function createLabel(data: {
  name: string;
  color: string;
  workspaceId: string;
  projectId?: string | null;
}) {
  // Projekt-Label vs. Workspace-Label haben unterschiedliche Permissions.
  if (data.projectId) {
    await requirePermission("label.create", {
      projectId: data.projectId,
    });
  } else {
    await requirePermission("label.create", {
      workspaceId: data.workspaceId,
    });
  }

  const slug = await uniqueLabelSlug(data.workspaceId, data.name);
  const label = await db.label.create({
    data: {
      id: uid("l"),
      name: data.name,
      slug,
      color: data.color,
      workspace: { connect: { id: data.workspaceId } },
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
    select: { projectId: true },
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

export async function setMemberRole(
  workspaceId: string,
  userId: string,
  roleKey: string,
) {
  const guard = "member.role.update" as const;
  const actorId = await requirePermission(guard, { workspaceId });
  // Der Rang kommt jetzt aus der Datenbank statt aus einer Konstantenliste —
  // damit greift die Hierarchie auch für selbst angelegte Rollen.
  const actorRank = (await accessFor(actorId, { workspaceId })).rank(
    "WORKSPACE",
  );

  const target = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: { select: { key: true, rank: true } } },
  });
  if (!target) throw new PermissionError(guard);

  // Owner ist unveränderlich; zum Owner befördern geht nur per Ownership-Transfer.
  if (target.role.key === OWNER_ROLE_KEY || roleKey === OWNER_ROLE_KEY) {
    throw new PermissionError(guard);
  }

  // Zuweisbar sind die geteilten System-Rollen und die eigenen dieses Workspace.
  const next = await db.role.findFirst({
    where: {
      scope: "WORKSPACE",
      key: roleKey,
      OR: [{ system: true }, { workspaceId }],
    },
    select: { id: true, rank: true },
  });
  if (!next) throw new PermissionError(guard);

  // Niemand darf eine höhere Rolle vergeben oder ein höher gestelltes Mitglied ändern.
  if (next.rank > actorRank || target.role.rank > actorRank) {
    throw new PermissionError(guard);
  }

  await db.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId } },
    data: { roleId: next.id },
  });
  await revalidate();
}

export async function removeMember(workspaceId: string, userId: string) {
  const guard = "member.remove" as const;
  const actorId = await requirePermission(guard, { workspaceId });
  const actorRank = (await accessFor(actorId, { workspaceId })).rank(
    "WORKSPACE",
  );

  const target = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: { select: { key: true, rank: true } } },
  });
  if (!target) throw new PermissionError(guard);

  // Der Owner kann nicht entfernt werden; höher gestellte Mitglieder ebenfalls nicht.
  if (target.role.key === OWNER_ROLE_KEY || target.role.rank > actorRank) {
    throw new PermissionError(guard);
  }

  await db.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  await revalidate();
}
