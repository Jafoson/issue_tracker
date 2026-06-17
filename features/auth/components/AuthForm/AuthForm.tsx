"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { login, register } from "@/features/auth/actions";
import styles from "./authForm.module.scss";

interface AuthFormProps {
  mode: "login" | "register";
  locale: string;
  callbackUrl?: string;
}

export function AuthForm({ mode, locale, callbackUrl }: AuthFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");

  function submit() {
    setError("");
    const fd = new FormData();
    fd.append("email",    email.trim());
    fd.append("password", password);
    fd.append("locale",   locale);
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
          {isLogin ? "Sign in to Orbit" : "Create your account"}
        </h1>
        <p className={styles.sub}>
          {isLogin
            ? "Enter your credentials to continue."
            : "Start tracking issues in seconds."}
        </p>

        <div className={styles.fields}>
          {!isLogin && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="auth-name">Full name</label>
              <input
                id="auth-name"
                className={styles.input}
                type="text"
                autoComplete="name"
                placeholder="Ada Lovelace"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className={styles.input}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus={isLogin}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="auth-password">Password</label>
            <div className={styles.passwordWrap}>
              <input
                id="auth-password"
                className={styles.input}
                type={showPw ? "text" : "password"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder={isLogin ? "••••••••" : "At least 8 characters"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                tabIndex={-1}
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                <Icon icon={showPw ? "lucide:eye-off" : "lucide:eye"} width={15} />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className={styles.error}>
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </div>
        )}

        <button className={styles.submit} onClick={submit}>
          {isLogin ? "Sign in" : "Create account"}
        </button>

        <p className={styles.switch}>
          {isLogin ? (
            <>No account? <Link href={`/${locale}/register`}>Sign up</Link></>
          ) : (
            <>Already have an account? <Link href={`/${locale}/login`}>Sign in</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
