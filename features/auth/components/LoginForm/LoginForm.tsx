"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/atoms/Input/Input";
import { login } from "@/features/auth/actions";
import { AuthCard } from "@/features/auth/components/AuthCard/AuthCard";
import { useRouter } from "@/i18n/navigation";

interface LoginFormProps {
  callbackUrl?: string;
  oauthProviders?: string[];
}

export function LoginForm({
  callbackUrl,
  oauthProviders = [],
}: LoginFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  function submit() {
    setError("");
    const fd = new FormData();
    fd.append("email", email.trim());
    fd.append("password", password);
    if (callbackUrl) fd.append("callbackUrl", callbackUrl);

    startTransition(async () => {
      const result = await login(fd);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(result.redirectTo);
      }
    });
  }

  return (
    <AuthCard
      title={t("login.signInTitle")}
      subtitle={t("login.signInSubtitle")}
      error={error}
      submitLabel={t("actions.signIn")}
      onSubmit={submit}
      oauthProviders={oauthProviders}
      switchText={t("login.noAccount")}
      switchLabel={t("login.signUp")}
      switchHref="/register"
    >
      <Input
        ref={emailRef}
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
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
    </AuthCard>
  );
}
