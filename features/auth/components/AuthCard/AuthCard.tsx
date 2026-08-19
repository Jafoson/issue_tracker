"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/atoms/Button/Button";
import { signInWithOAuth } from "@/features/auth/actions";
import styles from "./authCard.module.scss";

const OAUTH_META: Record<string, { label: string; icon: string }> = {
  github: { label: "GitHub", icon: "lucide:github" },
  google: { label: "Google", icon: "logos:google-icon" },
  gitlab: { label: "GitLab", icon: "logos:gitlab" },
  "microsoft-entra-id": { label: "Microsoft", icon: "logos:microsoft-icon" },
  apple: { label: "Apple", icon: "mdi:apple" },
  oidc: { label: "SSO", icon: "lucide:key-round" },
};

interface AuthCardProps {
  title: string;
  subtitle?: string;
  error?: string;
  /** Ohne `onSubmit` bleibt der generische Button weg — Formulare ohne
   *  eigenes Feld-basiertes Absenden (z. B. reine Passkey-Anmeldung) tragen
   *  ihren Auslöser stattdessen über `extra`. */
  submitLabel?: string;
  onSubmit?: () => void;
  oauthProviders?: string[];
  /** Überschreibt den Anzeigenamen einzelner Anbieter — für OIDC, dessen Name
   *  aus `AUTH_OIDC_NAME` kommt statt aus der festen Marken-Liste. */
  oauthLabels?: Record<string, string>;
  /** Zusätzlicher Anmeldeweg (z. B. Passkey-Button) — steht zwischen dem
   *  Submit-Button und den OAuth-Anbietern, teilt sich aber keine Optik mit
   *  ihnen (andere Bedingung, anderer Ceremony-Ablauf). */
  extra?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Reines UI-Shell für die Anmeldung: links die Marke (verborgen auf schmalen
 * Bildschirmen), rechts die Karte mit Titel, Feldern (`children`), Fehler,
 * Submit, Extra-Weg und OAuth-Zeilen. Enthält keine Formular-Logik.
 */
export function AuthCard({
  title,
  subtitle,
  error,
  submitLabel,
  onSubmit,
  oauthProviders = [],
  oauthLabels,
  extra,
  children,
}: AuthCardProps) {
  const t = useTranslations();

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroBrand}>
          <Icon icon="lucide:orbit" width={20} />
          <span>Orbit</span>
        </div>
        <div className={styles.heroCopy}>
          <h2>{t("login.heroTitle")}</h2>
          <p>{t("login.heroSubtitle")}</p>
        </div>
        <p className={styles.heroFoot}>
          <Icon icon="lucide:shield-check" width={14} />
          {t("login.heroFoot")}
        </p>
      </div>

      <div className={styles.formSide}>
        <div className={styles.card}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.sub}>{subtitle}</p>}

          {error && (
            <div className={styles.error}>
              <Icon icon="lucide:circle-alert" width={14} />
              {error}
            </div>
          )}

          <div className={styles.fields}>{children}</div>

          {onSubmit && submitLabel && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              full
              onClick={onSubmit}
            >
              {submitLabel}
            </Button>
          )}

          {extra}

          {oauthProviders.length > 0 && (
            <>
              <div className={styles.divider}>{t("login.or")}</div>
              {/* Ab drei Anbietern würde eine gestapelte Liste voller Knöpfe
                  die Karte sprengen — ab da nur noch Logos in einer Reihe,
                  wie bei Google/Apple/Facebook üblich. */}
              <div
                className={
                  oauthProviders.length >= 3
                    ? styles.oauthCompact
                    : styles.oauth
                }
              >
                {oauthProviders.map((provider) => {
                  const meta = OAUTH_META[provider] ?? {
                    label: provider,
                    icon: "lucide:log-in",
                  };
                  const label = oauthLabels?.[provider] ?? meta.label;
                  if (oauthProviders.length >= 3) {
                    return (
                      <form
                        key={provider}
                        action={signInWithOAuth.bind(null, provider)}
                      >
                        <Button
                          type="submit"
                          variant="elevated"
                          size="lg"
                          icon={<Icon icon={meta.icon} width={18} />}
                          aria-label={t("login.continueWith", {
                            provider: label,
                          })}
                          title={t("login.continueWith", { provider: label })}
                        />
                      </form>
                    );
                  }
                  return (
                    <form
                      key={provider}
                      className={styles.oauthForm}
                      action={signInWithOAuth.bind(null, provider)}
                    >
                      <Button
                        type="submit"
                        variant="elevated"
                        size="lg"
                        full
                        icon={<Icon icon={meta.icon} width={18} />}
                      >
                        {t("login.continueWith", { provider: label })}
                      </Button>
                    </form>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
