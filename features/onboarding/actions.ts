"use server";

import { revalidatePath } from "next/cache";
import { unstable_update } from "@/auth";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

type Result = { ok: true } | { error: string };

const NOT_LOGGED_IN = "You must be logged in.";
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,29}$/;

/**
 * Schließt das Onboarding ab: Benutzername bestätigen (Pflicht), Vor-/
 * Nachname anpassen (beides optional — beim Anlegen des Kontos schon mit
 * einem aus E-Mail/Providername abgeleiteten Wert vorbelegt, siehe `auth.ts`s
 * `createUser`-Override).
 *
 * Nur für selbst angemeldete Konten erreichbar (`app/[locale]/page.tsx`
 * leitet nur um, wenn `onboardedAt` noch leer ist) — eingeladene Konten haben
 * das Feld schon bei der Einladung gesetzt und laufen nie hier durch.
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
