"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { uid } from "@/lib/utils/id";

async function revalidate() {
  revalidatePath("/", "layout");
}

export async function moveIssue(id: string, status: string) {
  await db.issue.update({ where: { id }, data: { status } });
  await revalidate();
}

export async function reorderIssue(id: string, status: string, rank: number) {
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
  await db.issue.update({
    where: { id },
    data: {
      ...(patch.status      !== undefined && { status:      patch.status }),
      ...(patch.priority    !== undefined && { priority:    patch.priority }),
      ...(patch.assignee    !== undefined && { assigneeId:  patch.assignee }),
      ...(patch.labels      !== undefined && { labels:      patch.labels }),
      ...(patch.title       !== undefined && { title:       patch.title }),
      ...(patch.description !== undefined && { description: patch.description }),
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
  const project = await db.project.findUnique({
    where: { id: data.projectId },
    select: { workspaceId: true },
  });
  const last = await db.issue.findFirst({
    where: { project: { workspaceId: project?.workspaceId } },
    orderBy: { key: "desc" },
    select: { key: true },
  });
  await db.issue.create({
    data: {
      id:          uid("i"),
      key:         (last?.key ?? 100) + 1,
      title:       data.title,
      description: data.description,
      status:      data.status,
      priority:    data.priority,
      assigneeId:  data.assignee,
      labels:      data.labels,
      type:        data.type,
      projectId:   data.projectId,
      reporterId:  data.reporterId,
      rank:        Date.now(),
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
  const label = await db.label.create({
    data: {
      id:        uid("l"),
      name:      data.name,
      color:     data.color,
      workspace: { connect: { id: data.workspaceId } },
      ...(data.projectId ? { project: { connect: { id: data.projectId } } } : {}),
    },
  });
  await revalidate();
  return { id: label.id, name: label.name, color: label.color, projectId: label.projectId };
}

export async function deleteIssue(id: string) {
  await db.issue.delete({ where: { id } });
  await revalidate();
}

export async function addComment(issueId: string, body: string, authorId: string) {
  await db.comment.create({
    data: { id: uid("c"), body, issueId, authorId },
  });
  await revalidate();
}

export async function deleteComment(commentId: string) {
  await db.comment.delete({ where: { id: commentId } });
  await revalidate();
}

export async function setMemberRole(workspaceId: string, userId: string, role: string) {
  await db.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId } },
    data: { role },
  });
  await revalidate();
}

export async function removeMember(workspaceId: string, userId: string) {
  await db.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  await revalidate();
}
