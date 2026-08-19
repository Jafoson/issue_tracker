"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { openInvitation } from "@/lib/invitations";
import { enrollInWorkspaceProjects } from "@/lib/project-membership";
import { getSession } from "@/lib/session";

type AuthResult = { redirectTo: string } | { error: string };

/**
 * Verschickt den Anmeldelink. Funktioniert auch für ein vorab angelegtes,
 * eingeladenes Konto (`pending: true`, noch kein Passkey) — anders als
 * Passkey/OAuth kennt next-auths Mail-Provider keine `AccountNotLinked`-Sperre
 * für eine schon existierende Adresse: der Klick auf den Link *ist* der
 * Beweis, dass sie der Person gehört. `redirect: false` liefert das Ergebnis
 * zurück statt zu werfen — `sendVerificationRequest` (`auth.ts`) hat die Mail
 * zu diesem Zeitpunkt schon an `sendMail()` übergeben.
 */
export async function sendMagicLink(
  email: string,
  callbackUrl?: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Please enter your email address." };

  try {
    await signIn("nodemailer", {
      email: trimmed,
      redirect: false,
      redirectTo: callbackUrl || "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Could not send the magic link. Please try again." };
    }
    throw error;
  }

  return { ok: true };
}

/**
 * Schließt eine Einladung ab, nachdem die Person sich angemeldet hat (Magic
 * Link — für ein vorab angelegtes Konto der einzige Weg, siehe
 * `sendMagicLink`; danach kann sie sich in den eigenen Einstellungen einen
 * Passkey einrichten, wie jede andere Person auch).
 *
 * Diese Aktion setzt nur noch das, was eine Session allein nicht herstellt:
 *
 *   1. `pending = false` — erst damit greifen die Rechte der Workspace-Rolle,
 *   2. Aufnahme in die öffentlichen Projekte: zwischen Einladung und Annahme
 *      können neue dazugekommen sein.
 *
 * Ein Projekt-Gast hat keine Workspace-Mitgliedschaft. Für den entfällt beides
 * — sein Zugriff hängt allein an der Projektzeile, die schon steht.
 *
 * Verlangt eine Session, die zur Einladung passt — sonst könnte eine fremde,
 * eingeloggte Person eine Einladung annehmen, die gar nicht ihre ist.
 */
export async function acceptInvitation(token: string): Promise<AuthResult> {
  const session = await getSession();
  if (!session)
    return { error: "You must be signed in to accept this invitation." };

  const invitation = await openInvitation(db, token, new Date());
  if (!invitation) {
    // `openInvitation` schließt eine schon angenommene Einladung aus — das
    // ist hier nicht zwangsläufig ein Fehler: ruft dieselbe (eingeloggte)
    // Person diese Aktion für ihre eigene, gerade eben angenommene Einladung
    // ein zweites Mal auf (Doppel-Aufruf durch Reacts Dev-Strict-Mode auf
    // Server Components, erneuter Seitenaufruf, Zurück-Knopf), ist die
    // Aufnahme längst erledigt — derselbe Erfolg, kein zweiter Schreibvorgang.
    const already = await db.invitation.findUnique({
      where: { token },
      select: {
        userId: true,
        workspaceId: true,
        acceptedAt: true,
        workspace: { select: { suspended: true } },
      },
    });
    if (
      already?.acceptedAt &&
      already.userId === session.userId &&
      !already.workspace.suspended
    ) {
      return { redirectTo: `/${already.workspaceId}` };
    }
    // Unbekannt, abgelaufen, schon von jemand anderem benutzt oder Workspace
    // gesperrt — eine Meldung für alle Fälle, damit der Endpunkt kein Orakel
    // für gültige Tokens ist.
    return { error: "This invitation is no longer valid. Ask for a new one." };
  }
  if (session.userId !== invitation.userId) {
    return {
      error:
        "You're signed in with a different account. Sign out first, then open the invitation link again.",
    };
  }

  let joined = false;

  await db.$transaction(async (tx) => {
    const membership = await tx.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId: invitation.userId,
        },
      },
      select: { pending: true },
    });

    if (membership?.pending) {
      await tx.workspaceMember.update({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId: invitation.userId,
          },
        },
        data: { pending: false },
      });
      await enrollInWorkspaceProjects(tx, {
        workspaceId: invitation.workspaceId,
        userId: invitation.userId,
      });
      joined = true;
    }

    await tx.invitation.update({
      where: { token: invitation.token },
      data: { acceptedAt: new Date() },
    });
  });

  if (joined) {
    // Erst jetzt ist die Mitgliedschaft wirklich da — die Person nimmt ihre
    // eigene Einladung an, ist also zugleich Akteur und Ziel. Außerhalb der
    // Transaktion: ein klemmendes Protokoll soll die Annahme nicht verhindern.
    await recordAudit({
      action: "member.added",
      actorId: invitation.userId,
      target: {
        type: "user",
        id: invitation.userId,
        label: `${invitation.firstName} ${invitation.lastName}`.trim(),
      },
      workspaceId: invitation.workspaceId,
    });
  }

  return { redirectTo: `/${invitation.workspaceId}` };
}

export async function logout(): Promise<void> {
  await signOut({ redirect: true, redirectTo: "/login" });
}

/** OAuth-Login (GitHub/Google). Leitet direkt zum Provider weiter. */
export async function signInWithOAuth(provider: string): Promise<void> {
  await signIn(provider, { redirectTo: "/" });
}
