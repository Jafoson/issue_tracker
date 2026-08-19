"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/atoms/Button/Button";
import { OptionButton } from "@/components/ui/atoms/OptionButton/OptionButton";
import { signInWithOAuth } from "@/features/auth/actions";
import styles from "./authCard.module.scss";

const OAUTH_META: Record<
  string,
  { label: string; icon: string; kind: string }
> = {
  github: { label: "GitHub", icon: "lucide:github", kind: "OAuth" },
  google: {
    label: "Google",
    icon: "logos:google-icon",
    kind: "OpenID Connect",
  },
  oidc: { label: "SSO", icon: "lucide:shield-check", kind: "OIDC" },
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
  /** Untertitel-Zusatz je Anbieter — für OIDC der Issuer-Host
   *  (`AUTH_OIDC_ISSUER`), z. B. „OIDC · nimbus.io". */
  oauthHosts?: Record<string, string>;
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
  oauthHosts,
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

          <div className={styles.fields}>{children}</div>

          {error && (
            <div className={styles.error}>
              <Icon icon="lucide:circle-alert" width={14} />
              {error}
            </div>
          )}

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
              <div className={styles.oauth}>
                {oauthProviders.map((provider) => {
                  const meta = OAUTH_META[provider] ?? {
                    label: provider,
                    icon: "lucide:log-in",
                    kind: "OAuth",
                  };
                  const label = oauthLabels?.[provider] ?? meta.label;
                  const host = oauthHosts?.[provider];
                  return (
                    <form
                      key={provider}
                      className={styles.oauthForm}
                      action={signInWithOAuth.bind(null, provider)}
                    >
                      <OptionButton
                        type="submit"
                        icon={<Icon icon={meta.icon} width={18} />}
                        title={label}
                        subtitle={host ? `${meta.kind} · ${host}` : meta.kind}
                      />
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
