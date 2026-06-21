"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { uid } from "@/lib/utils/id";

type ProjectResult = { ok: true } | { error: string };

function basePrefix(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4) || "PROJ"
  );
}

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

async function uniqueSlug(workspaceId: string, base: string): Promise<string> {
  let slug = base || "project";
  let n = 0;
  while (
    await db.project.findUnique({
      where: { workspaceId_slug: { workspaceId, slug } },
      select: { id: true },
    })
  ) {
    slug = `${base}-${++n}`;
  }
  return slug;
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

  const allowed = await hasPermission("workspace.project.create", {
    workspaceId: data.workspaceId,
  });
  if (!allowed)
    return { error: "You are not allowed to create projects here." };

  const desired =
    (data.prefix?.trim() || basePrefix(name))
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4) || basePrefix(name);
  const prefix = await uniquePrefix(data.workspaceId, desired);
  const slug = await uniqueSlug(data.workspaceId, slugify(name));

  await db.project.create({
    data: {
      id: uid("p"),
      workspaceId: data.workspaceId,
      name,
      slug,
      prefix,
      color: data.color,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
