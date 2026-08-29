"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { sendMagicLink } from "@/features/auth/actions";
import { AuthCard } from "@/features/auth/components/AuthCard/AuthCard";
import { useRouter } from "@/i18n/navigation";
import styles from "./acceptInviteForm.module.scss";

interface Props {
  token: string;
  workspaceName: string;
  email: string;
  oauthProviders: string[];
  oidcLabel?: string;
}

/**
 * The last step of an invitation: sign in, no matter which way.
 *
 * The email address is fixed — it's part of the invitation, the field only
 * displays it. Two paths lead back to this exact page (`callbackUrl`/
 * `redirectTo: /invite/{token}`), with a session matching the invited shadow
 * account: magic link (goes through the code on `/login/verify`, like a
 * normal login) and single sign-on — `auth.ts`'s `signIn` callback links the
 * provider to the shadow account itself for this, without the usual
 * `OAuthAccountNotLinked` block, because an untouched shadow account has
 * nothing to hijack (see there). The second visit to this page calls
 * `acceptInvitation()` (pending flip, project enrollment) and redirects into
 * the workspace.
 *
 * Passkey is deliberately absent: registering one, per next-auth, requires
 * either an active session or an address that's still unknown — a shadow
 * account is neither. A passkey can only be set up afterward, with a
 * session, under Account → Security.
 */
export function AcceptInviteForm({
  token,
  workspaceName,
  email,
  oauthProviders,
  oidcLabel,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const sendMagic = () => {
    setError("");
    startTransition(async () => {
      const result = await sendMagicLink(email, `/invite/${token}`);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const params = new URLSearchParams({
        email,
        callbackUrl: `/invite/${token}`,
      });
      router.push(`/login/verify?${params}`);
    });
  };

  return (
    <AuthCard
      title={t("invite.title", { workspace: workspaceName })}
      subtitle={t("invite.subtitle")}
      error={error}
      submitLabel={isPending ? t("actions.saving") : t("invite.accept")}
      onSubmit={sendMagic}
      oauthProviders={oauthProviders}
      oauthLabels={oidcLabel ? { oidc: oidcLabel } : undefined}
    >
      <div className={styles.email}>
        <span className={styles.emailLabel}>{t("fields.email")}</span>
        <span className={styles.emailValue}>{email}</span>
      </div>
    </AuthCard>
  );
}
