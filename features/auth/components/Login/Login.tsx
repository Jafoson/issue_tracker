"use client";

import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { useTranslations } from "@/lib/translations-context";

import styles from "./login.module.scss";

function OrbitLogo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.2" fill="var(--accent)" />
      <ellipse
        cx="12"
        cy="12"
        rx="10"
        ry="4.6"
        stroke="var(--accent)"
        strokeWidth="1.7"
        transform="rotate(-28 12 12)"
        opacity=".85"
      />
      <circle cx="3.6" cy="9.2" r="1.5" fill="var(--accent)" />
    </svg>
  );
}

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const t = useTranslations();

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <OrbitLogo size={36} />
        </div>
        <h1 className={styles.title}>{t.login.signInTo("Orbit")}</h1>
        <p className={styles.sub}>{t.login.subtitle}</p>

        <Button
          variant="elevated"
          size="lg"
          full
          icon={<Icon icon="logos:google-icon" width={18} />}
          className={styles.googleBtn}
          onClick={onLogin}
        >
          {t.login.continueWithGoogle}
        </Button>

        <div className={styles.divider}>
          <span>{t.login.or}</span>
        </div>

        <Input
          variant="text"
          label={t.placeholders.email}
          placeholder="you@company.com"
        />
        <Input
          variant="password"
          label={t.placeholders.password}
          placeholder="••••••••"
        />

        <Button variant="primary" full onClick={onLogin}>
          {t.actions.signIn}
        </Button>

        <p className={styles.footnote}>
          {t.login.noAccount}{" "}
          <button type="button" onClick={onLogin}>
            {t.login.requestAccess}
          </button>
        </p>
      </div>
    </div>
  );
}
