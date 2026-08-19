// ─── Einladungen ──────────────────────────────────────────────────────────────
//
// Wer per E-Mail eingeladen wird, bekommt sofort ein Konto — ohne Passwort und
// mit `WorkspaceMember.pending = true`. Bis hierher kam das Projekt schon vorher;
// was fehlte, war der Weg von dort zum fertigen Zugang. Diese Datei ist dieser
// Weg: einen Token ausstellen, ihn einlösen, und dazwischen nichts verraten.
//
// Der Versand selbst steht nicht hier, sondern in `lib/mail` (`sendInvitationEmail`,
// aus den Aktionen aufgerufen) — diese Datei bleibt der schmale Token-Baustein.
// Ohne SMTP-Konfiguration verschickt `lib/mail` nichts; die Action gibt den Link
// trotzdem zurück, und die Oberfläche zeigt ihn zum Kopieren.

import { randomBytes } from "node:crypto";
import { appUrl } from "@/lib/app-url";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Passt auf den Prisma-Client wie auf einen Transaktions-Client. */
type Db = Prisma.TransactionClient;

/** Wie lange eine Einladung gilt. */
const VALID_DAYS = 14;

/**
 * 32 Byte aus dem Zufallsgenerator des Betriebssystems, base64url kodiert.
 *
 * Der Token ist der einzige Schutz des Links — er muss unerratbar sein, nicht
 * kurz. `randomBytes` statt `Math.random`: letzteres ist vorhersagbar.
 */
export function newInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface CreatedInvitation {
  token: string;
  /** Damit die Einladungsmail dieselbe Frist nennt, die auch gilt — statt
   *  `VALID_DAYS` an zwei Stellen zu pflegen. */
  expiresAt: Date;
}

/**
 * Stellt eine Einladung aus und gibt Token und Frist zurück.
 *
 * Ältere, noch offene Einladungen derselben Person in denselben Workspace werden
 * dabei verworfen: es soll nicht zwei Links geben, von denen einer ins Leere
 * führt, sobald der andere benutzt wurde.
 */
export async function createInvitation(
  db: Db,
  data: {
    userId: string;
    workspaceId: string;
    projectId?: string | null;
    invitedById?: string | null;
  },
  now: Date,
): Promise<CreatedInvitation> {
  await db.invitation.deleteMany({
    where: {
      userId: data.userId,
      workspaceId: data.workspaceId,
      acceptedAt: null,
    },
  });

  const token = newInvitationToken();
  const expires = new Date(now.getTime() + VALID_DAYS * 24 * 60 * 60 * 1000);

  await db.invitation.create({
    data: {
      token,
      userId: data.userId,
      workspaceId: data.workspaceId,
      projectId: data.projectId ?? null,
      invitedById: data.invitedById ?? null,
      expires,
    },
  });

  return { token, expiresAt: expires };
}

/** Der Pfad, unter dem eine Einladung angenommen wird. Ohne Locale-Präfix. */
export function invitationPath(token: string): string {
  return `/invite/${token}`;
}

/**
 * Die absolute Einladungs-URL.
 *
 * Woher die Basis kommt, steht in `lib/app-url` — dieselbe Quelle wie für jede
 * andere Adresse, die die App zum Kopieren anbietet.
 */
export function invitationUrl(token: string): string {
  return appUrl(invitationPath(token));
}

export interface OpenInvitation {
  token: string;
  workspaceId: string;
  workspaceName: string;
  projectId: string | null;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Das Konto hat schon einen Passkey — die Einladung ist überflüssig,
   *  eine normale Anmeldung reicht. */
  hasPasskey: boolean;
}

/**
 * Lädt eine Einladung, die noch eingelöst werden kann.
 *
 * `null` heißt in jedem Fall dasselbe: unbekannt, abgelaufen oder schon benutzt.
 * Die Seite zeigt darauf eine Meldung, die zwischen diesen Fällen nicht
 * unterscheidet — sonst wäre der Endpunkt ein Orakel für gültige Tokens.
 */
export async function openInvitation(
  db: Db,
  token: string,
  now: Date,
): Promise<OpenInvitation | null> {
  if (!token) return null;

  const invitation = await db.invitation.findUnique({
    where: { token },
    select: {
      token: true,
      workspaceId: true,
      projectId: true,
      expires: true,
      acceptedAt: true,
      workspace: { select: { name: true, suspended: true } },
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          authenticators: { select: { credentialID: true }, take: 1 },
        },
      },
    },
  });
  if (!invitation) return null;
  if (invitation.acceptedAt) return null;
  if (invitation.expires <= now) return null;
  // Ein gesperrter Workspace nimmt niemanden auf — auch keinen Eingeladenen.
  if (invitation.workspace.suspended) return null;

  return {
    token: invitation.token,
    workspaceId: invitation.workspaceId,
    workspaceName: invitation.workspace.name,
    projectId: invitation.projectId,
    userId: invitation.user.id,
    // Das Schatten-Konto einer Einladung entsteht immer mit der eingeladenen
    // Adresse — der Fallback ist reine Typsicherheit, kein erwarteter Fall.
    email: invitation.user.email ?? "",
    firstName: invitation.user.firstName,
    lastName: invitation.user.lastName,
    hasPasskey: invitation.user.authenticators.length > 0,
  };
}
