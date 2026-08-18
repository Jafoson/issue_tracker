// ─── Teilbare Einladungslinks ───────────────────────────────────────────────
//
// Anders als `lib/invitations.ts` (ein Token → ein vorab angelegtes Konto)
// ist ein Link hier generisch: unbegrenzt viele Personen können ihn einlösen,
// bis er widerrufen wird oder abläuft. Es gibt keine vorab bekannte Identität
// — die Person entscheidet sich erst beim Öffnen des Links, ob sie sich
// registriert oder mit einer bestehenden Sitzung beitritt (`redeemInviteLink`
// deckt beide Fälle mit demselben Code ab).
//
// Ein Scope (Workspace, optional zusätzlich ein Projekt, plus Rolle) trägt
// höchstens einen aktiven Link — `createInviteLink` widerruft einen
// vorherigen für denselben Scope, bevor der neue entsteht.

import { randomBytes } from "node:crypto";
import { appUrl } from "@/lib/app-url";
import type { Prisma } from "@/lib/generated/prisma/client";
import { enrollInWorkspaceProjects } from "@/lib/project-membership";
import { PROJECT_GUEST_ROLE_KEY } from "@/lib/rbac";

/** Passt auf den Prisma-Client wie auf einen Transaktions-Client. */
type Db = Prisma.TransactionClient;

/** 32 Byte aus dem Zufallsgenerator des Betriebssystems, base64url kodiert —
 *  wie `newInvitationToken` in `lib/invitations.ts`. */
export function newInviteLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Der Pfad, unter dem ein Einladungslink eingelöst wird. Ohne Locale-Präfix. */
export function inviteLinkPath(token: string): string {
  return `/join/${token}`;
}

export function inviteLinkUrl(token: string): string {
  return appUrl(inviteLinkPath(token));
}

export interface CreatedInviteLink {
  token: string;
  expiresAt: Date | null;
}

export async function createInviteLink(
  db: Db,
  data: {
    workspaceId: string;
    projectId?: string | null;
    roleId: string;
    createdById: string;
    expiresAt?: Date | null;
  },
  now: Date,
): Promise<CreatedInviteLink> {
  await db.inviteLink.updateMany({
    where: {
      workspaceId: data.workspaceId,
      projectId: data.projectId ?? null,
      roleId: data.roleId,
      revokedAt: null,
    },
    data: { revokedAt: now },
  });

  const token = newInviteLinkToken();
  await db.inviteLink.create({
    data: {
      token,
      workspaceId: data.workspaceId,
      projectId: data.projectId ?? null,
      roleId: data.roleId,
      createdById: data.createdById,
      expiresAt: data.expiresAt ?? null,
    },
  });

  return { token, expiresAt: data.expiresAt ?? null };
}

export interface ResolvedInviteLink {
  token: string;
  workspaceId: string;
  workspaceName: string;
  projectId: string | null;
  projectName: string | null;
  roleId: string;
  roleKey: string;
  roleName: string;
}

/**
 * Lädt einen Link, der noch eingelöst werden kann.
 *
 * `null` heißt in jedem Fall dasselbe: unbekannt, widerrufen, abgelaufen oder
 * Workspace gesperrt — dieselbe Zurückhaltung wie `openInvitation`, damit die
 * Seite kein Orakel für gültige Tokens wird.
 */
export async function resolveInviteLink(
  db: Db,
  token: string,
  now: Date,
): Promise<ResolvedInviteLink | null> {
  if (!token) return null;

  const link = await db.inviteLink.findUnique({
    where: { token },
    select: {
      token: true,
      workspaceId: true,
      projectId: true,
      roleId: true,
      expiresAt: true,
      revokedAt: true,
      workspace: { select: { name: true, suspended: true } },
      project: { select: { name: true } },
      role: { select: { key: true, name: true } },
    },
  });
  if (!link) return null;
  if (link.revokedAt) return null;
  if (link.expiresAt && link.expiresAt <= now) return null;
  if (link.workspace.suspended) return null;

  return {
    token: link.token,
    workspaceId: link.workspaceId,
    workspaceName: link.workspace.name,
    projectId: link.projectId,
    projectName: link.project?.name ?? null,
    roleId: link.roleId,
    roleKey: link.role.key,
    roleName: link.role.name,
  };
}

/**
 * Löst einen Link für eine angemeldete Person ein.
 *
 * Idempotent: schon Mitglied → no-op statt Fehler, dieselbe Adresse kann den
 * Link mehrfach öffnen (Reload, zweites Gerät), ohne dass danach etwas anders
 * dasteht. Kein `pending` — anders als bei `Invitation` gibt es kein
 * Schatten-Konto mit offenem Passwort, das Konto ist schon da und angemeldet.
 */
export async function redeemInviteLink(
  db: Db,
  link: ResolvedInviteLink,
  userId: string,
  defaultWorkspaceRoleId: string,
): Promise<void> {
  if (link.projectId) {
    await db.projectMember.upsert({
      where: { projectId_userId: { projectId: link.projectId, userId } },
      update: {},
      create: {
        projectId: link.projectId,
        userId,
        roleId: link.roleId,
        origin: "manual",
      },
    });

    // Wie beim E-Mail-Invite: ein Gast bleibt außen vor, jede andere Rolle
    // bringt eine vollwertige Workspace-Mitgliedschaft mit (und damit Zugriff
    // auf die öffentlichen Projekte, nicht nur das eine).
    if (link.roleKey !== PROJECT_GUEST_ROLE_KEY) {
      const existing = await db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: link.workspaceId, userId },
        },
        select: { userId: true },
      });
      if (!existing) {
        await db.workspaceMember.create({
          data: {
            workspaceId: link.workspaceId,
            userId,
            roleId: defaultWorkspaceRoleId,
            pending: false,
          },
        });
        await enrollInWorkspaceProjects(db, {
          workspaceId: link.workspaceId,
          userId,
        });
      }
    }
    return;
  }

  const existing = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: link.workspaceId, userId } },
    select: { userId: true },
  });
  if (!existing) {
    await db.workspaceMember.create({
      data: {
        workspaceId: link.workspaceId,
        userId,
        roleId: link.roleId,
        pending: false,
      },
    });
    await enrollInWorkspaceProjects(db, {
      workspaceId: link.workspaceId,
      userId,
    });
  }
}
