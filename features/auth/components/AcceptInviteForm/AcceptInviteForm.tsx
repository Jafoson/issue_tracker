"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/atoms/Input/Input";
import { acceptInvitation } from "@/features/auth/actions";
import { AuthCard } from "@/features/auth/components/AuthCard/AuthCard";
import { useRouter } from "@/i18n/navigation";
import styles from "./acceptInviteForm.module.scss";

interface Props {
  token: string;
  workspaceName: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Der letzte Schritt einer Einladung: Name und Passwort setzen.
 *
 * Die E-Mail-Adresse steht fest — sie ist Teil der Einladung und nicht das, was
 * hier entschieden wird. Deshalb zeigt das Feld sie nur an. Der Vorname ist beim
 * Einladen aus der Adresse geraten worden; hier korrigiert ihn die Person, die
 * ihn wirklich kennt.
 */
export function AcceptInviteForm({
  token,
  workspaceName,
  email,
  firstName: initialFirstName,
  lastName: initialLastName,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit() {
    setError("");
    const fd = new FormData();
    fd.append("firstName", firstName.trim());
    fd.append("lastName", lastName.trim());
    fd.append("password", password);

    startTransition(async () => {
      const result = await acceptInvitation(token, fd);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(result.redirectTo);
    });
  }

  return (
    <AuthCard
      title={t("invite.title", { workspace: workspaceName })}
      subtitle={t("invite.subtitle")}
      error={error}
      submitLabel={t("invite.accept")}
      onSubmit={submit}
      switchText={t("invite.haveAccount")}
      switchLabel={t("actions.signIn")}
      switchHref="/login"
    >
      <div className={styles.email}>
        <span className={styles.emailLabel}>{t("fields.email")}</span>
        <span className={styles.emailValue}>{email}</span>
      </div>

      <div className={styles.nameRow}>
        <Input
          id="invite-first-name"
          label={t("login.firstName")}
          autoComplete="given-name"
          placeholder={t("login.firstNamePlaceholder")}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Input
          id="invite-last-name"
          label={t("login.lastName")}
          autoComplete="family-name"
          placeholder={t("login.lastNamePlaceholder")}
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>

      <Input
        id="invite-password"
        variant="password"
        label={t("fields.password")}
        autoComplete="new-password"
        placeholder={t("login.passwordPlaceholderRegister")}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
    </AuthCard>
  );
}
