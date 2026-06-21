"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  PermissionError,
  requirePermission,
  requirePermissionOr,
  workspaceRoleKey,
} from "@/lib/permissions";
import { roleRank } from "@/lib/rbac";
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
  if (!issue) throw new PermissionError("project.issue.update.any");
  return issue;
}

export async function moveIssue(id: string, status: string) {
  const issue = await issueContext(id);
  await requirePermissionOr([
    {
      permission: "project.issue.update.any",
      ctx: { projectId: issue.projectId },
    },
    {
      permission: "project.issue.update.own",
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
      permission: "project.issue.update.any",
      ctx: { projectId: issue.projectId },
    },
    {
      permission: "project.issue.update.own",
      ctx: { projectId: issue.projectId },
      ownerIds: [issue.reporterId, issue.assigneeId],
    },
  ]);
  await db.issue.update({ where: { id }, data: { status, rank } });
  await revalidate();
}

export async function updateIssue(
  id: string,
  patch: {
    status?: string;
    priority?: number;
    assignee?: string | null;
    labels?: string[];
    title?: string;
    description?: string;
  },
) {
  const issue = await issueContext(id);
  const ctx = { projectId: issue.projectId };
  await requirePermissionOr([
    { permission: "project.issue.update.any", ctx },
    {
      permission: "project.issue.update.own",
      ctx,
      ownerIds: [issue.reporterId, issue.assigneeId],
    },
  ]);
  // Das (Neu-)Zuweisen eines Issues erfordert zusätzlich die Assign-Permission.
  if (patch.assignee !== undefined) {
    await requirePermission("project.issue.assign", ctx);
  }

  await db.issue.update({
    where: { id },
    data: {
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.priority !== undefined && { priority: patch.priority }),
      ...(patch.assignee !== undefined && { assigneeId: patch.assignee }),
      ...(patch.labels !== undefined && { labels: patch.labels }),
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.description !== undefined && {
        description: patch.description,
      }),
    },
  });
  await revalidate();
}

export async function createIssue(data: {
  title: string;
  description: string;
  status: string;
  priority: number;
  assignee: string | null;
  labels: string[];
  type: string;
  projectId: string;
  reporterId: string;
}) {
  // Reporter ist immer der eingeloggte User — nicht der Client-Parameter.
  const userId = await requirePermission("project.issue.create", {
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
      description: data.description,
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
    await requirePermission("project.label.create", {
      projectId: data.projectId,
    });
  } else {
    await requirePermission("workspace.label.create", {
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
      permission: "project.issue.delete.any",
      ctx: { projectId: issue.projectId },
    },
    {
      permission: "project.issue.delete.own",
      ctx: { projectId: issue.projectId },
      ownerIds: [issue.reporterId, issue.assigneeId],
    },
  ]);
  await db.issue.delete({ where: { id } });
  await revalidate();
}

export async function addComment(
  issueId: string,
  body: string,
  _authorId: string,
) {
  const issue = await db.issue.findUnique({
    where: { id: issueId },
    select: { projectId: true },
  });
  if (!issue) throw new PermissionError("project.comment.create");
  // Autor ist immer der eingeloggte User — der Parameter wird ignoriert.
  const userId = await requirePermission("project.comment.create", {
    projectId: issue.projectId,
  });

  await db.comment.create({
    data: { id: uid("c"), body, issueId, authorId: userId },
  });
  await revalidate();
}

export async function deleteComment(commentId: string) {
  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true, issue: { select: { projectId: true } } },
  });
  if (!comment) throw new PermissionError("project.comment.delete.any");
  const ctx = { projectId: comment.issue.projectId };
  await requirePermissionOr([
    { permission: "project.comment.delete.any", ctx },
    {
      permission: "project.comment.delete.own",
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
  role: string,
) {
  const actorId = await requirePermission("workspace.member.role.update", {
    workspaceId,
  });
  const actorRole = await workspaceRoleKey(workspaceId, actorId);
  if (!actorRole) throw new PermissionError("workspace.member.role.update");

  const target = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  if (!target) throw new PermissionError("workspace.member.role.update");

  // Owner ist unveränderlich; zum Owner befördern geht nur per Ownership-Transfer.
  if (target.role === "owner" || role === "owner") {
    throw new PermissionError("workspace.member.role.update");
  }
  // Die neue Rolle muss in diesem Workspace existieren.
  const roleExists = await db.role.findUnique({
    where: { workspaceId_key: { workspaceId, key: role } },
    select: { key: true },
  });
  if (!roleExists) throw new PermissionError("workspace.member.role.update");

  // Niemand darf eine höhere Rolle vergeben oder ein höher gestelltes Mitglied ändern.
  const actorRank = roleRank(actorRole);
  if (roleRank(role) > actorRank || roleRank(target.role) > actorRank) {
    throw new PermissionError("workspace.member.role.update");
  }

  await db.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId } },
    data: { role },
  });
  await revalidate();
}

export async function removeMember(workspaceId: string, userId: string) {
  const actorId = await requirePermission("workspace.member.remove", {
    workspaceId,
  });
  const actorRole = await workspaceRoleKey(workspaceId, actorId);
  if (!actorRole) throw new PermissionError("workspace.member.remove");

  const target = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  if (!target) throw new PermissionError("workspace.member.remove");

  // Der Owner kann nicht entfernt werden; höher gestellte Mitglieder ebenfalls nicht.
  if (target.role === "owner" || roleRank(target.role) > roleRank(actorRole)) {
    throw new PermissionError("workspace.member.remove");
  }

  await db.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  await revalidate();
}
