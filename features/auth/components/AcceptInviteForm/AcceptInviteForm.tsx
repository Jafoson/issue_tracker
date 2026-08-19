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
 * Der letzte Schritt einer Einladung: sich anmelden, egal auf welchem Weg.
 *
 * Die E-Mail-Adresse steht fest — sie ist Teil der Einladung, das Feld zeigt
 * sie nur an. Zwei Wege führen zurück auf genau diese Seite (`callbackUrl`/
 * `redirectTo: /invite/{token}`), mit einer Session, die zum eingeladenen
 * Schatten-Konto passt: Magic Link (führt über den Code auf `/login/verify`,
 * wie beim normalen Login) und Single Sign-On — `auth.ts`s `signIn`-Callback
 * verknüpft den Anbieter dafür selbst mit dem Schatten-Konto, ohne die sonst
 * übliche `OAuthAccountNotLinked`-Sperre, weil ein unberührtes Schatten-Konto
 * nichts zu kapern gibt (siehe dort). Der zweite Aufruf dieser Seite ruft
 * `acceptInvitation()` auf (Pending-Flip, Projekt-Enrollment) und leitet in
 * den Workspace weiter.
 *
 * Passkey fehlt bewusst: eine Registrierung dafür verlangt next-auth zufolge
 * entweder eine aktive Sitzung oder eine noch unbekannte Adresse — ein
 * Schatten-Konto ist beides nicht. Ein Passkey lässt sich erst danach, mit
 * einer Sitzung, unter Account → Sicherheit einrichten.
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
