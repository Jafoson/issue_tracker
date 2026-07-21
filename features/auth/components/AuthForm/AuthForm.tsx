"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { login, register, signInWithOAuth } from "@/features/auth/actions";
import { Link, useRouter } from "@/i18n/navigation";
import styles from "./authForm.module.scss";

interface AuthFormProps {
  mode: "login" | "register";
  callbackUrl?: string;
  oauthProviders?: string[];
}

const OAUTH_META: Record<string, { label: string; icon: string }> = {
  github: { label: "GitHub", icon: "lucide:github" },
  google: { label: "Google", icon: "logos:google-icon" },
};

export function AuthForm({
  mode,
  callbackUrl,
  oauthProviders = [],
}: AuthFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  // Focus the email field on the login screen (ersetzt autoFocus).
  useEffect(() => {
    if (mode === "login") emailRef.current?.focus();
  }, [mode]);

  function submit() {
    setError("");
    const fd = new FormData();
    fd.append("email", email.trim());
    fd.append("password", password);
    if (callbackUrl) fd.append("callbackUrl", callbackUrl);
    if (mode === "register") fd.append("name", name.trim());

    startTransition(async () => {
      const result = mode === "login" ? await login(fd) : await register(fd);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(result.redirectTo);
      }
    });
  }

  const isLogin = mode === "login";

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <Icon icon="lucide:orbit" width={28} />
        </div>

        <h1 className={styles.title}>
          {isLogin ? t("login.signInTitle") : t("login.registerTitle")}
        </h1>
        <p className={styles.sub}>
          {isLogin ? t("login.signInSubtitle") : t("login.registerSubtitle")}
        </p>

        <div className={styles.fields}>
          {!isLogin && (
            <Input
              id="auth-name"
              label={t("login.fullName")}
              autoComplete="name"
              placeholder={t("login.fullNamePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          )}

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
            autoComplete={isLogin ? "current-password" : "new-password"}
            placeholder={
              isLogin ? "••••••••" : t("login.passwordPlaceholderRegister")
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        {error && (
          <div className={styles.error}>
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </div>
        )}

        <Button type="button" variant="primary" size="lg" full onClick={submit}>
          {isLogin ? t("actions.signIn") : t("login.createAccount")}
        </Button>

        {oauthProviders.length > 0 && (
          <>
            <div className={styles.divider}>{t("login.or")}</div>
            <div className={styles.oauth}>
              {oauthProviders.map((provider) => {
                const meta = OAUTH_META[provider] ?? {
                  label: provider,
                  icon: "lucide:log-in",
                };
                return (
                  <form
                    key={provider}
                    className={styles.oauthForm}
                    action={signInWithOAuth.bind(null, provider)}
                  >
                    <Button
                      type="submit"
                      variant="outline"
                      size="lg"
                      full
                      icon={<Icon icon={meta.icon} width={16} />}
                    >
                      {t("login.continueWith", { provider: meta.label })}
                    </Button>
                  </form>
                );
              })}
            </div>
          </>
        )}

        <p className={styles.switch}>
          {isLogin ? (
            <>
              {t("login.noAccount")}{" "}
              <Link href="/register">{t("login.signUp")}</Link>
            </>
          ) : (
            <>
              {t("login.haveAccount")}{" "}
              <Link href="/login">{t("actions.signIn")}</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
