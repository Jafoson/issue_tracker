"use server";

import { revalidatePath } from "next/cache";
import { unstable_update } from "@/auth";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  type NotificationKey,
  type Theme,
} from "@/features/account/types";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  deleteAvatarObject,
  finalizeAvatarUpload,
  requestAvatarUpload,
} from "@/lib/storage";
import { isValidEmail } from "@/lib/utils/parse-emails";

// Die eigenen Einstellungen kennen keine Rechteprüfung, nur eine Frage: wer ist
// eingeloggt? Jede Aktion arbeitet ausschließlich auf diesem Konto — es gibt
// nirgends einen Parameter, mit dem sich ein fremdes treffen ließe.
//
// Alle geben Fehler zurück statt zu werfen: sie hängen an Formularen, die den
// Grund anzeigen sollen.

type Result = { ok: true } | { error: string };

const NOT_LOGGED_IN = "You must be logged in.";

const THEMES: Theme[] = ["dark", "light", "system"];

/** Alle gültigen Spaltennamen der Benachrichtigungen — Schutz vor allem, was
 *  sonst noch als String hereinkäme. */
const NOTIFICATION_KEYS = new Set<string>(
  NOTIFICATION_EVENTS.flatMap((event) =>
    NOTIFICATION_CHANNELS.map((channel) => `${event}${channel}`),
  ),
);

/**
 * Schreibt in die eigene Vorlieben-Zeile und legt sie an, falls es noch keine
 * gibt.
 *
 * `upsert` statt `update`, weil die Zeile erst mit der ersten Änderung entsteht
 * (siehe `features/account/queries.ts`). Beim Anlegen zählen für alles
 * Ungenannte die `@default`s aus dem Schema.
 */
async function writePreferences(
  userId: string,
  data: Record<string, string | boolean>,
): Promise<void> {
  await db.userPreferences.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

/**
 * Name, Benutzername und Farbe.
 *
 * Der Benutzername steht in den Filter-Adressen (`?assignee=@handle`) und ist
 * workspaceübergreifend eindeutig — deshalb die Prüfung auf Form und Kollision,
 * bevor die Datenbank mit ihrem eigenen Fehler antwortet.
 *
 * Zum Schluss wird das Sitzungs-Token nachgezogen: Name und Farbe stehen darin
 * und werden aus ihm gezeichnet (Menü unten links, Avatare). Ohne diesen Schritt
 * bliebe die Anzeige bis zur nächsten Anmeldung beim alten Stand — der Vorgang
 * sähe aus, als hätte er nicht gewirkt.
 */
export async function updateProfile(data: {
  firstName: string;
  lastName: string;
  handle: string;
  color: string;
}): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_LOGGED_IN };

  const firstName = data.firstName.trim();
  const lastName = data.lastName.trim();
  const handle = data.handle.trim().toLowerCase();
  const color = data.color.trim();

  // Vorname ist Pflicht, Nachname optional (`features/onboarding`).
  if (!firstName) return { error: "First name is required." };
  if (!/^[a-z0-9][a-z0-9-]{1,29}$/.test(handle)) {
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
    data: { firstName, lastName, handle, color },
  });

  await unstable_update({ user: { firstName, lastName, color } });

  revalidatePath("/", "layout");
  return { ok: true };
}

type UploadUrlResult =
  | { ok: true; key: string; uploadUrl: string }
  | { error: string };

/**
 * Erster Schritt des Avatar-Uploads: stellt eine presigned PUT-URL aus, gegen
 * die der Client direkt (ohne Umweg über den Server) hochlädt. Kein
 * `unstable_update()` nötig — anders als Name/Farbe steht der Avatar nicht im
 * Sitzungs-Token (`UserMenu` liest ihn schon heute live aus der DB, wie auch
 * `handle`), `revalidatePath` unten genügt.
 */
export async function requestAvatarUploadUrl(input: {
  contentType: string;
  contentLength: number;
}): Promise<UploadUrlResult> {
  const session = await getSession();
  if (!session) return { error: NOT_LOGGED_IN };

  return requestAvatarUpload({
    kind: "user",
    ownerId: session.userId,
    ...input,
  });
}

/** Zweiter Schritt: nach dem direkten PUT gegen S3 den Key in der DB
 *  hinterlegen und den vorherigen Avatar best-effort löschen. */
export async function confirmAvatarUpload(key: string): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_LOGGED_IN };

  const result = await finalizeAvatarUpload("user", session.userId, key);
  if ("error" in result) return result;

  const previous = await db.user.findUnique({
    where: { id: session.userId },
    select: { avatarKey: true },
  });
  await db.user.update({
    where: { id: session.userId },
    data: { avatarKey: key },
  });
  await deleteAvatarObject(previous?.avatarKey);

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeAvatar(): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_LOGGED_IN };

  const previous = await db.user.findUnique({
    where: { id: session.userId },
    select: { avatarKey: true },
  });
  await db.user.update({
    where: { id: session.userId },
    data: { avatarKey: null },
  });
  await deleteAvatarObject(previous?.avatarKey);

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Das Design.
 *
 * Hier wird festgehalten, was gelten soll; gerendert wird es vom Wurzel-Layout
 * als `data-theme` am `<html>`. `revalidatePath` unten sorgt dafür, dass das
 * Layout die neue Wahl auch wirklich neu rendert.
 */
export async function updateAppearance(data: {
  theme?: Theme;
}): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_LOGGED_IN };

  if (data.theme !== undefined && !THEMES.includes(data.theme)) {
    return { error: "Unknown theme." };
  }

  await writePreferences(session.userId, {
    ...(data.theme !== undefined ? { theme: data.theme } : {}),
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Der Hinweis im Plattform-Bereich: gelesen, oder wieder anzeigen.
 *
 * Eine Vorliebe wie das Design, deshalb steht sie hier und nicht bei den
 * Plattform-Aktionen — sie gehört der Person, nicht der Plattform, und gilt auf
 * jedem Gerät. Sie in der Datenbank zu halten statt im Browser hat einen
 * zweiten Grund: die Seite wird auf dem Server gerendert, und was nur der
 * Browser weiß, käme dort zu spät.
 */
export async function setAdminNoticeHidden(hidden: boolean): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_LOGGED_IN };

  await writePreferences(session.userId, { adminNoticeHidden: hidden });

  // Nur der Plattform-Bereich zeigt ihn — der Rest der App muss dafür nicht neu
  // gebaut werden.
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Ein einzelner Schalter der Benachrichtigungen.
 *
 * Einzeln und nicht als ganzer Satz: die Schalter gelten sofort, und wer einen
 * umlegt, hat zu genau einem Punkt eine Meinung geäußert. Ein Rundumschlag über
 * alle zehn würde bei zwei offenen Reitern den jeweils anderen Stand
 * überschreiben.
 */
export async function setNotification(
  key: NotificationKey,
  value: boolean,
): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_LOGGED_IN };
  if (!NOTIFICATION_KEYS.has(key)) return { error: "Unknown setting." };

  await writePreferences(session.userId, { [key]: value });
  return { ok: true };
}

/**
 * Eine Adresse zu einem Konto ohne E-Mail nachtragen (Passkey-Erstkonten,
 * `auth.ts`s WebAuthn-`getUserInfo`).
 *
 * Nur *hinzufügen*, nicht *ändern*: ein Konto mit schon gesetzter Adresse
 * lehnt ab — eine bestehende Anmeldeadresse zu ersetzen ist eine
 * sicherheitsrelevante Operation, die eine Bestätigung der neuen Adresse
 * verlangen würde, und es gibt in dieser App noch kein Token-System dafür
 * (`lib/mail`s `emailVerification.ts` ist "noch nicht verdrahtet"). Die
 * frisch eingetragene Adresse landet deshalb als `emailVerified: null` —
 * unbestätigt, aber nutzbar für Magic Link/Einladung/Benachrichtigung, genau
 * wie jede andere unbestätigte Adresse in dieser App auch.
 */
export async function addEmail(email: string): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_LOGGED_IN };

  const trimmed = email.trim().toLowerCase();
  if (!isValidEmail(trimmed)) {
    return { error: "Please enter a valid email address." };
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  if (!user) return { error: NOT_LOGGED_IN };
  if (user.email) {
    return { error: "This account already has an email address." };
  }

  const taken = await db.user.findUnique({
    where: { email: trimmed },
    select: { id: true },
  });
  if (taken) return { error: "This email address is already in use." };

  await db.user.update({
    where: { id: session.userId },
    data: { email: trimmed, emailVerified: null },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Einen fremden Anmeldeweg vom Konto lösen.
 *
 * Der letzte geht nicht: ohne verbundenes Konto und ohne Passkey käme niemand
 * mehr herein. Geprüft wird das hier und nicht in der Oberfläche — der Knopf
 * ist dort zwar ausgeblendet, aber eine Server Function ist eine Adresse wie
 * jede andere.
 */
export async function disconnectAccount(provider: string): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_LOGGED_IN };

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      accounts: { select: { provider: true } },
      authenticators: { select: { credentialID: true } },
    },
  });
  if (!user) return { error: NOT_LOGGED_IN };

  if (!user.accounts.some((a) => a.provider === provider)) {
    return { error: "This account is not connected." };
  }
  if (user.authenticators.length === 0 && user.accounts.length <= 1) {
    return {
      error:
        "This is your only way to sign in. Add a passkey first, then disconnect it.",
    };
  }

  await db.account.deleteMany({ where: { userId: session.userId, provider } });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Einen Passkey vom Konto entfernen.
 *
 * Derselbe „letzter Weg hinein"-Schutz wie bei `disconnectAccount`: die
 * verbundenen Anbieter und die übrigen Passkeys zählen zusammen als Pool —
 * bleibt keiner übrig, wird nicht gelöscht.
 */
export async function removePasskey(credentialID: string): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: NOT_LOGGED_IN };

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      accounts: { select: { provider: true } },
      authenticators: { select: { credentialID: true } },
    },
  });
  if (!user) return { error: NOT_LOGGED_IN };

  if (!user.authenticators.some((a) => a.credentialID === credentialID)) {
    return { error: "This passkey is not on your account." };
  }

  const remainingWaysIn =
    user.accounts.length + (user.authenticators.length - 1);
  if (remainingWaysIn === 0) {
    return {
      error:
        "This is your only way to sign in. Add another method first, then remove it.",
    };
  }

  await db.authenticator.delete({ where: { credentialID } });

  revalidatePath("/", "layout");
  return { ok: true };
}
