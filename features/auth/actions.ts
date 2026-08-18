"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { openInvitation } from "@/lib/invitations";
import { enrollInWorkspaceProjects } from "@/lib/project-membership";
import {
  DEFAULT_PLATFORM_ROLE_KEY,
  DEFAULT_WORKSPACE_ROLE_KEY,
  systemRoleId,
} from "@/lib/rbac";
import { generateHandle, pickUserColor } from "@/lib/user-defaults";

type AuthResult = { redirectTo: string } | { error: string };

async function defaultRedirectFor(userId: string): Promise<string> {
  const membership = await db.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true },
  });
  // Locale-freie Pfade – der Client navigiert über next-intl (auto-Präfix).
  return membership ? `/${membership.workspaceId}` : "/create-workspace";
}

export async function login(formData: FormData): Promise<AuthResult> {
  const email =
    (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) return { error: "Email and password are required." };

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError)
      return { error: "Invalid email or password." };
    throw error;
  }

  const callbackUrl = (formData.get("callbackUrl") as string | null) ?? "";
  if (callbackUrl) return { redirectTo: callbackUrl };

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return {
    redirectTo: user ? await defaultRedirectFor(user.id) : "/create-workspace",
  };
}

/**
 * Selbst-Registrierung. Trifft die Adresse eine Domain, die ein Workspace per
 * `addWorkspaceDomain()` beansprucht hat, tritt das neue Konto ihm sofort bei
 * — ohne Einladungslink, ohne `pending` (die Adresse ist ja gerade erst
 * getippt worden, derselbe Vertrauensgrad wie jede andere Registrierung hier).
 * Beides — Konto und Beitritt — in einer Transaktion: sonst könnte ein
 * Domain-Fehler ein Konto ohne nutzbaren Weg zurücklassen (weder Workspace
 * noch `/create-workspace`, weil das ja gerade übersprungen wurde).
 */
export async function register(formData: FormData): Promise<AuthResult> {
  const firstName = (formData.get("firstName") as string | null)?.trim() ?? "";
  const lastName = (formData.get("lastName") as string | null)?.trim() ?? "";
  const email =
    (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  // Zum Beispiel `/join/{token}`, wenn die Registrierung aus einem
  // Einladungslink kommt — wie bei `login()`.
  const callbackUrl = (formData.get("callbackUrl") as string | null) ?? "";

  if (!firstName || !lastName || !email || !password)
    return { error: "All fields are required." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Please enter a valid email address." };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists." };

  const passwordHash = await bcrypt.hash(password, 12);
  const handle = await generateHandle(email);
  const domain = email.split("@")[1] ?? "";

  let userId: string;
  try {
    userId = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName,
          lastName,
          handle,
          email,
          color: pickUserColor(),
          passwordHash,
          // Jedes neue Konto startet ohne Plattform-Rechte.
          platformRoleId: systemRoleId("PLATFORM", DEFAULT_PLATFORM_ROLE_KEY),
        },
        select: { id: true },
      });

      const claim = await tx.workspaceDomain.findUnique({
        where: { domain },
        select: { workspaceId: true },
      });
      if (claim) {
        await tx.workspaceMember.create({
          data: {
            workspaceId: claim.workspaceId,
            userId: user.id,
            roleId: systemRoleId("WORKSPACE", DEFAULT_WORKSPACE_ROLE_KEY),
            pending: false,
          },
        });
        await enrollInWorkspaceProjects(tx, {
          workspaceId: claim.workspaceId,
          userId: user.id,
        });
      }

      return user.id;
    });
  } catch {
    return { error: "Registration failed. Please try again." };
  }

  // Session über Auth.js etablieren (Credentials-Login mit den frischen Daten).
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
  }

  if (callbackUrl) return { redirectTo: callbackUrl };
  return { redirectTo: await defaultRedirectFor(userId) };
}

/**
 * Nimmt eine Einladung an: Name und Passwort setzen, Zugang freischalten.
 *
 * Das Konto gibt es an dieser Stelle schon — es entstand beim Einladen, ohne
 * Passwort und mit `WorkspaceMember.pending = true`. Hier bekommt es beides, was
 * es zum Arbeiten braucht:
 *
 *   1. Passwort und Name (das Konto war bis hier nicht anmeldbar),
 *   2. `pending = false` — erst damit greifen die Rechte der Workspace-Rolle,
 *   3. Aufnahme in die öffentlichen Projekte: zwischen Einladung und Annahme
 *      können neue dazugekommen sein.
 *
 * Ein Projekt-Gast hat keine Workspace-Mitgliedschaft. Für den entfallen 2 und 3
 * — sein Zugriff hängt allein an der Projektzeile, die schon steht.
 *
 * Der Token gilt danach als verbraucht (`acceptedAt`), unabhängig davon, ob der
 * anschließende Login klappt: er ist eine Einladung, kein Passwort-Reset.
 */
export async function acceptInvitation(
  token: string,
  formData: FormData,
): Promise<AuthResult> {
  const firstName = (formData.get("firstName") as string | null)?.trim() ?? "";
  const lastName = (formData.get("lastName") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!firstName) return { error: "Please enter your first name." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };

  const invitation = await openInvitation(db, token, new Date());
  // Unbekannt, abgelaufen, schon benutzt oder Workspace gesperrt — eine Meldung
  // für alle Fälle, damit der Endpunkt kein Orakel für gültige Tokens ist.
  if (!invitation)
    return { error: "This invitation is no longer valid. Ask for a new one." };

  const passwordHash = await bcrypt.hash(password, 12);

  let joined = false;

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: invitation.userId },
      data: { firstName, lastName, passwordHash },
    });

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
        label: `${firstName} ${lastName}`.trim(),
      },
      workspaceId: invitation.workspaceId,
    });
  }

  try {
    await signIn("credentials", {
      email: invitation.email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    // Der Zugang steht, nur die Sitzung nicht — von der Anmeldeseite kommt die
    // Person jetzt mit ihrem neuen Passwort hinein.
    return { redirectTo: "/login" };
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
