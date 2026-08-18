// ─── Öffentlicher Issue-Link ────────────────────────────────────────────────
//
// `Issue.shareToken` ist `null`, solange Teilen aus ist. Anders als bei
// Einladungen gibt es keinen Verlauf und keinen Zähler — nur einen aktiven
// Link pro Issue, der sich an- und ausschalten sowie neu erzeugen lässt. Wer
// wann geteilt hat, steht im Audit-Log (`issue.shared`/`issue.share.revoked`),
// nicht hier.

import { randomBytes } from "node:crypto";
import { appUrl } from "@/lib/app-url";

/** 32 Byte aus dem Zufallsgenerator des Betriebssystems, base64url kodiert —
 *  wie `newInvitationToken` in `lib/invitations.ts`. */
export function newIssueShareToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Der Pfad, unter dem ein geteiltes Issue öffentlich zu sehen ist. Ohne
 *  Locale-Präfix. */
export function issueSharePath(token: string): string {
  return `/share/${token}`;
}

export function issueShareUrl(token: string): string {
  return appUrl(issueSharePath(token));
}
