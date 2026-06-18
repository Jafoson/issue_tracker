"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  DEFAULT_STATUSES,
  DEFAULT_PRIORITIES,
  DEFAULT_ISSUE_TYPES,
  DEFAULT_ROLES,
} from "@/lib/workspace-defaults";

type WorkspaceResult = { redirectTo: string } | { error: string };

// Find a free workspace slug, appending 1, 2, 3… until one is available.
async function uniqueWorkspaceSlug(base: string): Promise<string> {
  const root = base || "workspace";
  let slug = root;
  let n = 0;
  while (await db.workspace.findUnique({ where: { id: slug }, select: { id: true } })) {
    slug = `${root}${++n}`;
  }
  return slug;
}

// Used by the create form to show the slug that will actually be used.
export async function suggestWorkspaceSlug(base: string): Promise<string> {
  return uniqueWorkspaceSlug(base);
}

export async function createWorkspace(formData: FormData): Promise<WorkspaceResult> {
  const session = await getSession();
  if (!session) return { error: "You must be logged in." };

  const name   = (formData.get("name")   as string | null)?.trim() ?? "";
  const slug   = (formData.get("slug")   as string | null)?.trim() ?? "";
  const color  = (formData.get("color")  as string | null)?.trim() || "#6e63e6";
  const locale = (formData.get("locale") as string | null) ?? "de";

  if (!name || !slug) return { error: "Name and slug are required." };
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 1) {
    return { error: "Slug may only contain lowercase letters, numbers, and hyphens." };
  }

  // Auto-dedupe: if the slug is taken, fall back to slug1, slug2, …
  const finalSlug = await uniqueWorkspaceSlug(slug);

  const projectId = crypto.randomUUID();
  const prefix = name
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4) || finalSlug.toUpperCase().slice(0, 4);

  try {
    await db.$transaction(async (tx) => {
      await tx.workspace.create({ data: { id: finalSlug, name, color } });

      await tx.workspaceStatus.createMany({
        data: DEFAULT_STATUSES.map((s) => ({ workspaceId: finalSlug, statusId: s.id })),
      });
      await tx.workspacePriority.createMany({
        data: DEFAULT_PRIORITIES.map((p) => ({ workspaceId: finalSlug, priorityId: p.id })),
      });
      await tx.workspaceIssueType.createMany({
        data: DEFAULT_ISSUE_TYPES.map((t) => ({ workspaceId: finalSlug, issueTypeId: t.id })),
      });
      await tx.workspaceRole.createMany({
        data: DEFAULT_ROLES.map((r) => ({ workspaceId: finalSlug, roleId: r.id })),
      });

      await tx.workspaceMember.create({
        data: { workspaceId: finalSlug, userId: session.userId, role: "admin", pending: false },
      });

      await tx.project.create({
        data: { id: projectId, workspaceId: finalSlug, name, prefix, color },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[createWorkspace]", msg);
    return { error: "Something went wrong. Please try again." };
  }

  return { redirectTo: `/${locale}/w/${finalSlug}/board/${projectId}` };
}
