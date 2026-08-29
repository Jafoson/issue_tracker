"use server";

import { revalidatePath } from "next/cache";
import { DASHBOARD_SCOPES } from "@/features/dashboard/scope";
import { PROJECT_VIEWS } from "@/features/dashboard/view";
import { isWidgetKey } from "@/features/dashboard/widgets";
import { RANGES, type RangeKey } from "@/lib/buckets";
import { db } from "@/lib/db";
import { currentUserCanEnterWorkspace, hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/session";

// Like your own settings (`features/account/actions.ts`), these actions only
// ask one question about the person: who is logged in? There is no "which
// user" parameter — writes always go to your own row.
//
// The project, on the other hand, comes in from outside and is therefore
// checked. Not because the row contains anything worth protecting — it's an
// arrangement of tiles — but because without a check, anyone logged in could
// create rows for arbitrary project ids. Same permission as for reading the
// dashboard.

type Result = { ok: true } | { error: string };

const NOT_ALLOWED = "You cannot change this dashboard.";

/**
 * Writes to your own row and creates it if none exists yet.
 *
 * `upsert` instead of `update`, because the row only comes into existence
 * with the first change: anyone who never customizes anything has none, and
 * that's the normal case.
 */
async function write(
  projectId: string,
  data: {
    hidden?: string[];
    order?: string[];
    range?: string;
    view?: string;
    scope?: string;
  },
): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_ALLOWED };
  if (!(await hasPermission("project.view", { projectId }))) {
    return { error: NOT_ALLOWED };
  }

  await db.dashboardPreference.upsert({
    where: { userId_projectId: { userId: session.userId, projectId } },
    create: { userId: session.userId, projectId, ...data },
    update: data,
  });

  // As everywhere in this project: the whole tree from the root. Naming the
  // page specifically would be possible, but would mean maintaining its
  // route path, including group and placeholders, a second time here — and
  // that breaks silently the moment the route moves.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Save the arrangement: what sits where, and what's deselected.
 *
 * Both in one call, because it's a single action — the dialog closes with
 * one resulting state, not two. What comes in is filtered against the
 * registry: an unknown key isn't an error reported to the caller, it's one
 * that simply isn't saved.
 */
export async function saveDashboardLayout(
  projectId: string,
  order: string[],
  hidden: string[],
): Promise<Result> {
  return write(projectId, {
    order: order.filter(isWidgetKey),
    hidden: hidden.filter(isWidgetKey),
  });
}

/** The period this dashboard will open with going forward. */
export async function setDashboardRange(
  projectId: string,
  range: string,
): Promise<Result> {
  if (!(RANGES as readonly string[]).includes(range)) {
    return { error: `Unknown range: ${range}` };
  }
  return write(projectId, { range: range as RangeKey });
}

/**
 * The view this project page will open in going forward.
 *
 * Written along on every toggle, so the project row in the sidebar leads
 * back to wherever you last were. Unlike the layout, there's no "save" for
 * this: it's an observation, not a setting.
 */
export async function setDashboardView(
  projectId: string,
  view: string,
): Promise<Result> {
  if (!(PROJECT_VIEWS as readonly string[]).includes(view)) {
    return { error: `Unknown view: ${view}` };
  }
  return write(projectId, { view });
}

/**
 * The scope this dashboard will open with going forward — "all" or "mine".
 *
 * `"all"` requires `dashboard.view.all`: without the permission, the toggle
 * doesn't even appear, but a direct call to this action shouldn't be able to
 * set the saved row to a scope the person wouldn't get on read anyway
 * (`getProjectDashboard` forces "mine" there).
 */
export async function setDashboardScope(
  projectId: string,
  scope: string,
): Promise<Result> {
  if (!(DASHBOARD_SCOPES as readonly string[]).includes(scope)) {
    return { error: `Unknown scope: ${scope}` };
  }
  if (
    scope === "all" &&
    !(await hasPermission("dashboard.view.all", { projectId }))
  ) {
    return { error: NOT_ALLOWED };
  }
  return write(projectId, { scope });
}

/**
 * Reset to the default — the row disappears.
 *
 * Deleting, not "write in every default value": a row that holds exactly the
 * default would freeze it in place. Whoever adds a widget later would find
 * it stuck at a fixed position for everyone who ever reset — or not appear
 * for them at all.
 */
export async function resetDashboardLayout(projectId: string): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_ALLOWED };

  await db.dashboardPreference.deleteMany({
    where: { userId: session.userId, projectId },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

// ─── The same, one level up: a workspace's dashboard ──────────────────────────
//
// Same structure as above — `write`, three actions, the same access check.
// No `setDashboardView` counterpart: for a workspace, dashboard and overview
// are two separate routes, not a stored view.

async function writeWorkspace(
  workspaceId: string,
  data: { hidden?: string[]; order?: string[]; range?: string; scope?: string },
): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_ALLOWED };
  if (!(await currentUserCanEnterWorkspace(workspaceId))) {
    return { error: NOT_ALLOWED };
  }

  await db.workspaceDashboardPreference.upsert({
    where: { userId_workspaceId: { userId: session.userId, workspaceId } },
    create: { userId: session.userId, workspaceId, ...data },
    update: data,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveWorkspaceDashboardLayout(
  workspaceId: string,
  order: string[],
  hidden: string[],
): Promise<Result> {
  return writeWorkspace(workspaceId, {
    order: order.filter(isWidgetKey),
    hidden: hidden.filter(isWidgetKey),
  });
}

export async function setWorkspaceDashboardRange(
  workspaceId: string,
  range: string,
): Promise<Result> {
  if (!(RANGES as readonly string[]).includes(range)) {
    return { error: `Unknown range: ${range}` };
  }
  return writeWorkspace(workspaceId, { range: range as RangeKey });
}

/** The scope this workspace dashboard will open with going forward — the counterpart to `setDashboardScope`. */
export async function setWorkspaceDashboardScope(
  workspaceId: string,
  scope: string,
): Promise<Result> {
  if (!(DASHBOARD_SCOPES as readonly string[]).includes(scope)) {
    return { error: `Unknown scope: ${scope}` };
  }
  if (
    scope === "all" &&
    !(await hasPermission("dashboard.view.all", { workspaceId }))
  ) {
    return { error: NOT_ALLOWED };
  }
  return writeWorkspace(workspaceId, { scope });
}

export async function resetWorkspaceDashboardLayout(
  workspaceId: string,
): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_ALLOWED };

  await db.workspaceDashboardPreference.deleteMany({
    where: { userId: session.userId, workspaceId },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
