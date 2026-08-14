// ─── Vorschau ────────────────────────────────────────────────────────────────
//
// Rendert eine Vorlage mit Beispieldaten — für den Admin-Editor, live bei
// jedem Tastendruck. Importiert bewusst nur aus `lib/mail/templates/*`, nie
// aus `lib/mail/index.ts` oder `lib/mail/send.ts`: die einen sind reine
// Funktionen ohne `server-only`, die anderen brauchen die Datenbank. Diese
// Datei muss aus einer Client-Komponente heraus laufen können.

import type { MailTemplateKey } from "@/features/mail-templates/catalog";
import { emailVerificationEmail } from "@/lib/mail/templates/emailVerification";
import { invitationEmail } from "@/lib/mail/templates/invitation";
import { issueUpdateEmail } from "@/lib/mail/templates/issueUpdate";
import { memberRemovedEmail } from "@/lib/mail/templates/memberRemoved";
import { notificationEmail } from "@/lib/mail/templates/notification";
import type { TemplateOverride } from "@/lib/mail/templates/override";
import { passwordResetEmail } from "@/lib/mail/templates/passwordReset";
import type { MailContent } from "@/lib/mail/templates/types";
import { weeklyDigestEmail } from "@/lib/mail/templates/weeklyDigest";
import { welcomeEmail } from "@/lib/mail/templates/welcome";

const SAMPLE_TO = "mara@example.com";
const SAMPLE_URL = "https://issues.example.com/acme/issue/ACME-42";
const SAMPLE_MANAGE_URL =
  "https://issues.example.com/acme/account/notifications";

export function renderMailPreview(
  key: MailTemplateKey,
  override?: TemplateOverride,
): MailContent {
  switch (key) {
    case "invitation":
      return invitationEmail(
        {
          to: SAMPLE_TO,
          workspaceName: "Acme",
          projectName: "Apollo Redesign",
          roleName: "Mitarbeiter:in",
          inviterName: "Jonas Reuter",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          inviteUrl: "https://issues.example.com/invite/abc123",
        },
        override,
      );
    case "memberRemoved":
      return memberRemovedEmail(
        {
          to: SAMPLE_TO,
          workspaceName: "Acme",
          projectName: "Apollo Redesign",
          actorName: "Jonas Reuter",
        },
        override,
      );
    case "welcome":
      return welcomeEmail(
        {
          to: SAMPLE_TO,
          firstName: "Mara",
          loginUrl: "https://issues.example.com/login",
        },
        override,
      );
    case "emailVerification":
      return emailVerificationEmail(
        {
          to: SAMPLE_TO,
          firstName: "Mara",
          verifyUrl: "https://issues.example.com/verify/abc123",
          expiresInHours: 24,
        },
        override,
      );
    case "passwordReset":
      return passwordResetEmail(
        {
          to: SAMPLE_TO,
          requestedAt: new Date(),
          device: "Chrome auf macOS",
          location: "Hamburg, DE",
          expiresInMinutes: 60,
          resetUrl: "https://issues.example.com/reset/abc123",
          securityUrl: "https://issues.example.com/acme/account/security",
        },
        override,
      );
    case "notification.assigned":
      return notificationEmail(
        {
          to: SAMPLE_TO,
          type: "assigned",
          actorLabel: "Jonas Reuter",
          text: "",
          workspaceName: "Acme",
          project: { name: "Apollo Redesign" },
          issue: { identifier: "ACME-42", title: "Login-Fehler beheben" },
          url: SAMPLE_URL,
          manageUrl: SAMPLE_MANAGE_URL,
        },
        override,
      );
    case "notification.mentioned":
      return notificationEmail(
        {
          to: SAMPLE_TO,
          type: "mentioned",
          actorLabel: "Jonas Reuter",
          text: "@mara kannst du das noch prüfen?",
          workspaceName: "Acme",
          project: { name: "Apollo Redesign" },
          issue: { identifier: "ACME-42", title: "Login-Fehler beheben" },
          url: SAMPLE_URL,
          manageUrl: SAMPLE_MANAGE_URL,
        },
        override,
      );
    case "notification.comment":
      return notificationEmail(
        {
          to: SAMPLE_TO,
          type: "comment",
          actorLabel: "Jonas Reuter",
          text: "Screenreader liest die Reihenfolge falsch vor — bitte vor dem Release fixen.",
          workspaceName: "Acme",
          project: { name: "Apollo Redesign" },
          issue: { identifier: "ACME-42", title: "Login-Fehler beheben" },
          url: SAMPLE_URL,
          manageUrl: SAMPLE_MANAGE_URL,
        },
        override,
      );
    case "notification.status":
      return notificationEmail(
        {
          to: SAMPLE_TO,
          type: "status",
          actorLabel: "Jonas Reuter",
          text: "in_progress",
          workspaceName: "Acme",
          project: { name: "Apollo Redesign" },
          issue: { identifier: "ACME-42", title: "Login-Fehler beheben" },
          url: SAMPLE_URL,
          manageUrl: SAMPLE_MANAGE_URL,
        },
        override,
      );
    case "notification.invite":
      return notificationEmail(
        {
          to: SAMPLE_TO,
          type: "invite",
          actorLabel: "Jonas Reuter",
          text: "Mitarbeiter:in",
          workspaceName: "Acme",
          project: null,
          issue: null,
          url: SAMPLE_MANAGE_URL,
          manageUrl: SAMPLE_MANAGE_URL,
        },
        override,
      );
    case "notification.role":
      return notificationEmail(
        {
          to: SAMPLE_TO,
          type: "role",
          actorLabel: "Jonas Reuter",
          text: "Admin",
          workspaceName: "Acme",
          project: null,
          issue: null,
          url: SAMPLE_MANAGE_URL,
          manageUrl: SAMPLE_MANAGE_URL,
        },
        override,
      );
    case "weeklyDigest":
      return weeklyDigestEmail(
        {
          to: SAMPLE_TO,
          firstName: "Mara",
          workspaceName: "Acme",
          periodLabel: "7.–14. August",
          assignedOpenCount: 3,
          completedCount: 5,
          createdCount: 2,
          highlights: [
            {
              identifier: "ACME-42",
              title: "Login-Fehler beheben",
              statusLabel: "Erledigt",
            },
          ],
          url: "https://issues.example.com/acme/my",
        },
        override,
      );
    case "issueUpdate":
      return issueUpdateEmail(
        {
          to: SAMPLE_TO,
          actorLabel: "Jonas Reuter",
          issue: { identifier: "ACME-42", title: "Login-Fehler beheben" },
          changes: [
            { field: "Priorität", from: "Mittel", to: "Hoch" },
            { field: "Titel", to: "Login-Fehler dringend beheben" },
          ],
          url: SAMPLE_URL,
        },
        override,
      );
  }
}
