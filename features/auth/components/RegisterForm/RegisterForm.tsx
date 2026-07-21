"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/atoms/Input/Input";
import { register } from "@/features/auth/actions";
import { AuthCard } from "@/features/auth/components/AuthCard/AuthCard";
import { useRouter } from "@/i18n/navigation";
import styles from "./registerForm.module.scss";

interface RegisterFormProps {
  oauthProviders?: string[];
}

export function RegisterForm({ oauthProviders = [] }: RegisterFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit() {
    setError("");
    const fd = new FormData();
    fd.append("firstName", firstName.trim());
    fd.append("lastName", lastName.trim());
    fd.append("email", email.trim());
    fd.append("password", password);

    startTransition(async () => {
      const result = await register(fd);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(result.redirectTo);
      }
    });
  }

  return (
    <AuthCard
      title={t("login.registerTitle")}
      subtitle={t("login.registerSubtitle")}
      error={error}
      submitLabel={t("login.createAccount")}
      onSubmit={submit}
      oauthProviders={oauthProviders}
      switchText={t("login.haveAccount")}
      switchLabel={t("actions.signIn")}
      switchHref="/login"
    >
      <div className={styles.nameRow}>
        <Input
          id="auth-first-name"
          label={t("login.firstName")}
          autoComplete="given-name"
          placeholder={t("login.firstNamePlaceholder")}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Input
          id="auth-last-name"
          label={t("login.lastName")}
          autoComplete="family-name"
          placeholder={t("login.lastNamePlaceholder")}
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>

      <Input
        id="auth-email"
        label={t("fields.email")}
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />

      <Input
        id="auth-password"
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
