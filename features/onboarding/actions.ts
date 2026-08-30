"use server";

import { revalidatePath } from "next/cache";
import { unstable_update } from "@/auth";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

type Result = { ok: true } | { error: string };

const NOT_LOGGED_IN = "You must be logged in.";
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,29}$/;

/**
 * Completes onboarding: username and first name are required, last name
 * stays optional.
 *
 * Only reachable for self-registered accounts (`app/[locale]/page.tsx` only
 * redirects when `onboardedAt` is still empty) — invited accounts already
 * have the field set at invitation time and never pass through here.
 */
export async function completeOnboarding(data: {
  handle: string;
  firstName: string;
  lastName: string;
}): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_LOGGED_IN };

  const handle = data.handle.trim().toLowerCase();
  const firstName = data.firstName.trim();
  const lastName = data.lastName.trim();

  if (!firstName) return { error: "First name is required." };
  if (!HANDLE_PATTERN.test(handle)) {
    return {
      error:
        "The username may contain lowercase letters, numbers and hyphens (2–30 characters).",
    };
  }

  const taken = await db.user.findUnique({
    where: { handle },
    select: { id: true },
  });
  if (taken && taken.id !== session.userId) {
    return { error: "This username is already taken." };
  }

  await db.user.update({
    where: { id: session.userId },
    data: { handle, firstName, lastName, onboardedAt: new Date() },
  });

  await unstable_update({ user: { firstName, lastName } });

  revalidatePath("/", "layout");
  return { ok: true };
}
