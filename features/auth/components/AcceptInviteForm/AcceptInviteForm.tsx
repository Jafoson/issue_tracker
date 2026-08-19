"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { sendMagicLink } from "@/features/auth/actions";
import { AuthCard } from "@/features/auth/components/AuthCard/AuthCard";
import styles from "./acceptInviteForm.module.scss";

interface Props {
  token: string;
  workspaceName: string;
  email: string;
}

/**
 * Der letzte Schritt einer Einladung: den Anmeldelink anfordern.
 *
 * Die E-Mail-Adresse steht fest — sie ist Teil der Einladung, das Feld zeigt
 * sie nur an. Der Link führt zurück auf genau diese Seite (`redirectTo`); mit
 * der dann frischen Session schließt `acceptInvitation()` die Aufnahme ab
 * (`pending = false`, Projekt-Enrollment). Einen Passkey richtet die Person
 * danach in den eigenen Einstellungen ein, wie jede andere auch — nicht
 * hier: ohne Session lässt sich keiner an dieses schon existierende Konto
 * hängen (next-auths Passkey-Registrierung verweigert das für eine bekannte
 * Adresse ohne aktive Sitzung).
 */
export function AcceptInviteForm({ token, workspaceName, email }: Props) {
  const t = useTranslations();
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError("");
    startTransition(async () => {
      const result = await sendMagicLink(email, `/invite/${token}`);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  };

  return (
    <AuthCard
      title={t("invite.title", { workspace: workspaceName })}
      subtitle={t("invite.subtitle")}
      error={error}
      submitLabel={
        isPending
          ? t("actions.saving")
          : sent
            ? t("login.linkSent")
            : t("invite.accept")
      }
      onSubmit={sent ? undefined : submit}
    >
      <div className={styles.email}>
        <span className={styles.emailLabel}>{t("fields.email")}</span>
        <span className={styles.emailValue}>{email}</span>
      </div>

      {sent && (
        <p className={styles.sent}>
          <Icon icon="lucide:mail-check" width={16} />
          {t("login.linkSentDesc")}
        </p>
      )}
    </AuthCard>
  );
}
