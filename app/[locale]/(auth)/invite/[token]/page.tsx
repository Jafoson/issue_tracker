import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";
import { enabledOAuthProviders, oidcProviderName } from "@/auth.config";
import { acceptInvitation } from "@/features/auth/actions";
import { AcceptInviteForm } from "@/features/auth/components/AcceptInviteForm/AcceptInviteForm";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { db } from "@/lib/db";
import { openInvitation } from "@/lib/invitations";
import { getSession } from "@/lib/session";
import styles from "./page.module.scss";

export const dynamic = "force-dynamic";

function InvalidInviteCard({
  title,
  text,
  signInLabel,
}: {
  title: string;
  text: string;
  signInLabel: string;
}) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.icon}>
          <Icon icon="lucide:mail-x" width={26} />
        </span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
        <Link className={styles.link} href="/login">
          {signInLabel}
        </Link>
      </div>
    </div>
  );
}

/**
 * Accept an invitation.
 *
 * The token in the path is the authorization — that's why this page lives in
 * the `(auth)` route group and is reachable without a session (`proxy.ts`).
 *
 * Unknown, expired, already used: all three cases look the same. A difference
 * in the message would reveal which tokens exist.
 *
 * Actually joining runs in two steps through the same page: first, without a
 * session, it shows `AcceptInviteForm` (magic link or single sign-on for the
 * invited account — see there for why no passkey); signing in leads back
 * here — now with a session matching the invited account. This second call
 * invokes `acceptInvitation()` (pending flip, project enrollment) and
 * redirects into the workspace.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const [t, invitation, session] = await Promise.all([
    getTranslations(),
    openInvitation(db, token, new Date()),
    getSession(),
  ]);

  if (!invitation || invitation.hasPasskey) {
    // `openInvitation` excludes an already-accepted invitation — before the
    // generic "invalid" message kicks in: maybe the person now signed in just
    // accepted this very invitation themselves a moment ago (a double call
    // from React's dev Strict Mode on Server Components, reloading the page,
    // the back button) — in that case it's not an error but already done,
    // see `acceptInvitation()`.
    if (session) {
      const already = await db.invitation.findUnique({
        where: { token },
        select: {
          userId: true,
          workspaceId: true,
          acceptedAt: true,
          workspace: { select: { suspended: true } },
        },
      });
      if (
        already?.acceptedAt &&
        already.userId === session.userId &&
        !already.workspace.suspended
      ) {
        redirect({ href: `/${already.workspaceId}`, locale: locale as Locale });
      }
    }
    // An account with a passkey no longer needs an invitation, just a
    // sign-in — the UI shows the same message either way.
    return (
      <InvalidInviteCard
        title={t("invite.invalidTitle")}
        text={t("invite.invalidText")}
        signInLabel={t("actions.signIn")}
      />
    );
  }

  if (session?.userId === invitation.userId) {
    const result = await acceptInvitation(invitation.token);
    if ("redirectTo" in result) {
      redirect({ href: result.redirectTo, locale: locale as Locale });
    }
    // An error here (e.g. token expired in the meantime) — the same generic
    // message as an invalid token, instead of revealing the reason.
    return (
      <InvalidInviteCard
        title={t("invite.invalidTitle")}
        text={t("invite.invalidText")}
        signInLabel={t("actions.signIn")}
      />
    );
  }

  return (
    <AcceptInviteForm
      token={invitation.token}
      workspaceName={invitation.workspaceName}
      email={invitation.email}
      oauthProviders={enabledOAuthProviders}
      oidcLabel={oidcProviderName}
    />
  );
}
