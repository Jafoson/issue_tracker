"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/atoms/Button/Button";
import { signInWithOAuth } from "@/features/auth/actions";
import { Link } from "@/i18n/navigation";
import styles from "./authCard.module.scss";

const OAUTH_META: Record<string, { label: string; icon: string }> = {
  github: { label: "GitHub", icon: "lucide:github" },
  google: { label: "Google", icon: "logos:google-icon" },
};

interface AuthCardProps {
  title: string;
  subtitle: string;
  error?: string;
  submitLabel: string;
  onSubmit: () => void;
  oauthProviders?: string[];
  switchText: string;
  switchLabel: string;
  switchHref: "/login" | "/register";
  children: React.ReactNode;
}

// Reines UI-Shell für Login/Register: Logo, Titel, Felder (children), Fehler,
// Submit, OAuth-Buttons und der Wechsel-Link. Enthält keine Formular-Logik.
export function AuthCard({
  title,
  subtitle,
  error,
  submitLabel,
  onSubmit,
  oauthProviders = [],
  switchText,
  switchLabel,
  switchHref,
  children,
}: AuthCardProps) {
  const t = useTranslations();

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <Icon icon="lucide:orbit" width={28} />
        </div>

        <h1 className={styles.title}>{title}</h1>
        <p className={styles.sub}>{subtitle}</p>

        <div className={styles.fields}>{children}</div>

        {error && (
          <div className={styles.error}>
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </div>
        )}

        <Button
          type="button"
          variant="primary"
          size="lg"
          full
          onClick={onSubmit}
        >
          {submitLabel}
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
          {switchText} <Link href={switchHref}>{switchLabel}</Link>
        </p>
      </div>
    </div>
  );
}
