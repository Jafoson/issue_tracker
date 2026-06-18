"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { uid } from "@/lib/utils/id";

type ProjectResult = { ok: true } | { error: string };

// Derive a prefix candidate from the project name (letters/digits, uppercased, max 4).
function basePrefix(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4) || "PROJ"
  );
}

// Find a free prefix within the workspace. The combination (workspaceId, prefix)
// is unique, so append 1, 2, 3… until one is available.
async function uniquePrefix(
  workspaceId: string,
  base: string,
): Promise<string> {
  let prefix = base;
  let n = 0;
  while (
    await db.project.findUnique({
      where: { workspaceId_prefix: { workspaceId, prefix } },
      select: { id: true },
    })
  ) {
    const suffix = String(++n);
    prefix = `${base.slice(0, 4 - suffix.length)}${suffix}`;
  }
  return prefix;
}

export async function createProject(data: {
  workspaceId: string;
  name: string;
  prefix?: string;
  color: string;
}): Promise<ProjectResult> {
  const session = await getSession();
  if (!session) return { error: "You must be logged in." };

  const name = data.name.trim();
  if (!name) return { error: "Name is required." };

  const member = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: data.workspaceId,
        userId: session.userId,
      },
    },
    select: { pending: true },
  });
  if (!member || member.pending)
    return { error: "You are not a member of this workspace." };

  const desired =
    (data.prefix?.trim() || basePrefix(name))
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4) || basePrefix(name);
  const prefix = await uniquePrefix(data.workspaceId, desired);

  await db.project.create({
    data: {
      id: uid("p"),
      workspaceId: data.workspaceId,
      name,
      prefix,
      color: data.color,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
