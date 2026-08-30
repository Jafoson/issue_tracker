"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

// Neither action checks anything beyond the session — the same
// self-scoping logic as in `features/account/actions.ts`: your own inbox
// belongs to nobody but whoever reads it, so there's nothing for RBAC to
// decide here.

type Result = { ok: true } | { error: string };

const NOT_LOGGED_IN = "You must be logged in.";

export async function markNotificationRead(id: string): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_LOGGED_IN };

  await db.notification.updateMany({
    where: { id, userId: session.userId, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsRead(
  workspaceId: string,
): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_LOGGED_IN };

  await db.notification.updateMany({
    where: { userId: session.userId, workspaceId, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
