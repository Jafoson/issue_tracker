import "server-only";
import { db } from "@/lib/db";
import { getMailTemplateOverride } from "@/lib/mail/overrides";
import { isMailConfigured, sendMail } from "@/lib/mail/send";
import { invitationEmail } from "@/lib/mail/templates/invitation";
import { memberRemovedEmail } from "@/lib/mail/templates/memberRemoved";

export { isMailConfigured, sendMail } from "@/lib/mail/send";
export type { EmailVerificationInput } from "@/lib/mail/templates/emailVerification";
export { emailVerificationEmail } from "@/lib/mail/templates/emailVerification";
export type { InvitationEmailInput } from "@/lib/mail/templates/invitation";
export { invitationEmail } from "@/lib/mail/templates/invitation";
export type {
  IssueUpdateChange,
  IssueUpdateEmailInput,
} from "@/lib/mail/templates/issueUpdate";
export { issueUpdateEmail } from "@/lib/mail/templates/issueUpdate";
export type { MemberRemovedEmailInput } from "@/lib/mail/templates/memberRemoved";
export { memberRemovedEmail } from "@/lib/mail/templates/memberRemoved";
export type { NotificationEmailInput } from "@/lib/mail/templates/notification";
export { notificationEmail } from "@/lib/mail/templates/notification";
export type { PasswordResetEmailInput } from "@/lib/mail/templates/passwordReset";
export { passwordResetEmail } from "@/lib/mail/templates/passwordReset";
export type { MailContent } from "@/lib/mail/templates/types";
export type {
  WeeklyDigestEmailInput,
  WeeklyDigestHighlight,
} from "@/lib/mail/templates/weeklyDigest";
export { weeklyDigestEmail } from "@/lib/mail/templates/weeklyDigest";
export type { WelcomeEmailInput } from "@/lib/mail/templates/welcome";
export { welcomeEmail } from "@/lib/mail/templates/welcome";

export interface SendInvitationEmailInput {
  to: string;
  workspaceId: string;
  /** Gesetzt = Einladung in ein bestimmtes Projekt. */
  projectId?: string | null;
  /** Wer eingeladen hat. */
  inviterId: string;
  roleName: string;
  expiresAt: Date;
  inviteUrl: string;
}

/**
 * Verschickt die Einladungsmail für ein neu angelegtes Konto (unbekannte
 * Adresse in `inviteWorkspaceMember`/`inviteProjectMember`) — der einzige Weg
 * für diese Person, an ihr passwortloses Konto zu kommen.
 *
 * Lädt Workspace-, Projekt- und Einladendennamen selbst nach, damit die
 * Aufrufer nur die Ids durchreichen müssen. Schluckt jeden Fehler: die
 * Mitgliedschaft steht zu diesem Zeitpunkt schon, eine hakende Mail darf sie
 * nicht rückgängig machen. Ohne SMTP-Konfiguration bleibt es beim kopierbaren
 * Link, den die Aktionen ohnehin zurückgeben.
 */
export async function sendInvitationEmail(
  input: SendInvitationEmailInput,
): Promise<void> {
  if (!isMailConfigured()) return;

  try {
    const [workspace, project, inviter, override] = await Promise.all([
      db.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { name: true },
      }),
      input.projectId
        ? db.project.findUnique({
            where: { id: input.projectId },
            select: { name: true },
          })
        : Promise.resolve(null),
      db.user.findUnique({
        where: { id: input.inviterId },
        select: { firstName: true, lastName: true },
      }),
      getMailTemplateOverride("invitation"),
    ]);
    if (!workspace) return;

    const { subject, html, text } = invitationEmail(
      {
        to: input.to,
        workspaceName: workspace.name,
        projectName: project?.name ?? null,
        roleName: input.roleName,
        inviterName: inviter
          ? `${inviter.firstName} ${inviter.lastName}`.trim()
          : "Jemand",
        expiresAt: input.expiresAt,
        inviteUrl: input.inviteUrl,
      },
      override,
    );
    await sendMail({ to: input.to, subject, html, text });
  } catch (error) {
    console.error("[mail] Einladung nicht verschickt:", error);
  }
}

export interface SendMemberRemovedEmailInput {
  /** Wer entfernt wurde. */
  userId: string;
  workspaceId: string;
  /** Gesetzt = nur aus diesem Projekt entfernt, Workspace-Zugriff bleibt. */
  projectId?: string | null;
  /** Wer entfernt hat. */
  actorId: string;
}

/**
 * Verschickt die Mail für `removeMember`/`removeProjectMember` — lädt
 * Empfänger-, Workspace-, Projekt- und Handelndennamen selbst nach, damit die
 * Aufrufer nur Ids durchreichen müssen (wie `sendInvitationEmail`).
 *
 * Schluckt jeden Fehler: die Mitgliedschaft ist zu diesem Zeitpunkt schon
 * weg, eine hakende Mail darf das nicht rückgängig machen.
 */
export async function sendMemberRemovedEmail(
  input: SendMemberRemovedEmailInput,
): Promise<void> {
  if (!isMailConfigured()) return;

  try {
    const [user, workspace, project, actor, override] = await Promise.all([
      db.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      }),
      db.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { name: true },
      }),
      input.projectId
        ? db.project.findUnique({
            where: { id: input.projectId },
            select: { name: true },
          })
        : Promise.resolve(null),
      db.user.findUnique({
        where: { id: input.actorId },
        select: { firstName: true, lastName: true },
      }),
      getMailTemplateOverride("memberRemoved"),
    ]);
    if (!user || !workspace) return;

    const { subject, html, text } = memberRemovedEmail(
      {
        to: user.email,
        workspaceName: workspace.name,
        projectName: project?.name ?? null,
        actorName: actor
          ? `${actor.firstName} ${actor.lastName}`.trim()
          : "Jemand",
      },
      override,
    );
    await sendMail({ to: user.email, subject, html, text });
  } catch (error) {
    console.error("[mail] Entfernen nicht verschickt:", error);
  }
}
