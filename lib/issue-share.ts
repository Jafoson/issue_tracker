// ─── Öffentlicher Issue-Link ────────────────────────────────────────────────
//
// `Issue.shareToken` ist `null`, solange Teilen aus ist. Anders als bei
// Einladungen gibt es keinen Verlauf und keinen Zähler — nur einen aktiven
// Link pro Issue, der sich an- und ausschalten sowie neu erzeugen lässt. Jede
// Änderung steht zusätzlich im Audit-Log (`issue.shared`/`issue.share.revoked`).

import { randomBytes } from "node:crypto";
import { appUrl } from "@/lib/app-url";

/** Wie lange ein neu erzeugter Link gilt, bevor `/share/[token]` ihn wie einen
 *  unbekannten Token behandelt — dieselbe Zurückhaltung wie bei
 *  Einladungs-/Beitrittslinks, nur mit einer festen statt einer wählbaren
 *  Frist (kein Bedarf für eine eigene Auswahl in der Oberfläche). */
export const ISSUE_SHARE_LINK_DAYS = 30;

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
