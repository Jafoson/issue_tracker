"use client";

import { Icon } from "@iconify/react";
import { useEffect, useRef, useState, useTransition } from "react";
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
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
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
              <label className={styles.label} htmlFor="auth-name">
                Full name
              </label>
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
            <label className={styles.label} htmlFor="auth-email">
              Email
            </label>
            <input
              ref={emailRef}
              id="auth-email"
              className={styles.input}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="auth-password">
              Password
            </label>
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
                <Icon
                  icon={showPw ? "lucide:eye-off" : "lucide:eye"}
                  width={15}
                />
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

        <button type="button" className={styles.submit} onClick={submit}>
          {isLogin ? "Sign in" : "Create account"}
        </button>

        {oauthProviders.length > 0 && (
          <>
            <div className={styles.divider}>or</div>
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
                    <button type="submit" className={styles.oauthBtn}>
                      <Icon icon={meta.icon} width={16} />
                      Continue with {meta.label}
                    </button>
                  </form>
                );
              })}
            </div>
          </>
        )}

        <p className={styles.switch}>
          {isLogin ? (
            <>
              No account? <Link href="/register">Sign up</Link>
            </>
          ) : (
            <>
              Already have an account? <Link href="/login">Sign in</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
