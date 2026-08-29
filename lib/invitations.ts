// ─── Invitations ──────────────────────────────────────────────────────────────
//
// Whoever is invited by email gets an account immediately — without a
// password and with `WorkspaceMember.pending = true`. The project already
// got this far before; what was missing was the path from there to a
// finished login. This file is that path: issue a token, redeem it, and
// give nothing away in between.
//
// Sending the mail itself doesn't live here, but in `lib/mail`
// (`sendInvitationEmail`, called from the actions) — this file stays the
// narrow token building block. Without SMTP configuration, `lib/mail` sends
// nothing; the action still returns the link, and the UI shows it for
// copying.

import { randomBytes } from "node:crypto";
import { appUrl } from "@/lib/app-url";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Fits both the Prisma client and a transaction client. */
type Db = Prisma.TransactionClient;

/** How long an invitation stays valid. */
const VALID_DAYS = 14;

/**
 * 32 bytes from the OS's random number generator, base64url encoded.
 *
 * The token is the link's only protection — it needs to be unguessable, not
 * short. `randomBytes` instead of `Math.random`: the latter is predictable.
 */
export function newInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface CreatedInvitation {
  token: string;
  /** So the invitation email states the same deadline that actually applies
   *  — instead of maintaining `VALID_DAYS` in two places. */
  expiresAt: Date;
}

/**
 * Issues an invitation and returns the token and deadline.
 *
 * Older, still-open invitations for the same person in the same workspace
 * are discarded in the process: there shouldn't be two links where one
 * leads nowhere as soon as the other is used.
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

/** The path where an invitation is accepted. Without a locale prefix. */
export function invitationPath(token: string): string {
  return `/invite/${token}`;
}

/**
 * The absolute invitation URL.
 *
 * Where the base comes from is documented in `lib/app-url` — the same
 * source as for every other URL the app offers for copying.
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
  /** The account already has a passkey — the invitation is redundant,
   *  a normal login is enough. */
  hasPasskey: boolean;
}

/**
 * Loads an invitation that can still be redeemed.
 *
 * `null` always means the same thing: unknown, expired, or already used.
 * The page shows a message for it that doesn't distinguish between these
 * cases — otherwise the endpoint would be an oracle for valid tokens.
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
  // A suspended workspace admits no one — not even someone invited.
  if (invitation.workspace.suspended) return null;

  return {
    token: invitation.token,
    workspaceId: invitation.workspaceId,
    workspaceName: invitation.workspace.name,
    projectId: invitation.projectId,
    userId: invitation.user.id,
    // An invitation's shadow account is always created with the invited
    // address — the fallback is pure type safety, not an expected case.
    email: invitation.user.email ?? "",
    firstName: invitation.user.firstName,
    lastName: invitation.user.lastName,
    hasPasskey: invitation.user.authenticators.length > 0,
  };
}
