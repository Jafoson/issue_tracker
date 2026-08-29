// ─── Public issue link ───────────────────────────────────────────────────────
//
// `Issue.shareToken` is `null` as long as sharing is off. Unlike
// invitations, there's no history and no counter — just one active link per
// issue, which can be turned on and off and regenerated. Every change is
// additionally recorded in the audit log (`issue.shared`/`issue.share.revoked`).

import { randomBytes } from "node:crypto";
import { appUrl } from "@/lib/app-url";

/** How long a newly generated link stays valid before `/share/[token]`
 *  treats it like an unknown token — the same reticence as invitation/join
 *  links, just with a fixed instead of a selectable deadline (no need for
 *  its own picker in the UI). */
export const ISSUE_SHARE_LINK_DAYS = 30;

/** 32 bytes from the OS's random number generator, base64url encoded —
 *  same as `newInvitationToken` in `lib/invitations.ts`. */
export function newIssueShareToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The path where a shared issue is publicly visible. Without a locale
 *  prefix. */
export function issueSharePath(token: string): string {
  return `/share/${token}`;
}

export function issueShareUrl(token: string): string {
  return appUrl(issueSharePath(token));
}
