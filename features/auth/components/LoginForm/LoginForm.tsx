"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { sendMagicLink } from "@/features/auth/actions";
import { AuthCard } from "@/features/auth/components/AuthCard/AuthCard";
import { PasskeyLoginButton } from "@/features/auth/components/PasskeyLoginButton/PasskeyLoginButton";
import { useRouter } from "@/i18n/navigation";
import styles from "./loginForm.module.scss";

interface LoginFormProps {
  callbackUrl?: string;
  oauthProviders?: string[];
  /** Anzeigename des OIDC-Providers (`AUTH_OIDC_NAME`) — server-only,
   *  deshalb als fertiger Wert von der Seite gereicht. */
  oidcLabel?: string;
  /** Issuer-Host des OIDC-Providers (`AUTH_OIDC_ISSUER`), für den
   *  Zeilen-Untertitel „OIDC · {host}" — server-only. */
  oidcHost?: string;
  /** Ob `next-auth/providers/nodemailer` aktiv ist (`isMailConfigured()`,
   *  server-only — deshalb als fertiger Wert von der Seite gereicht). Ohne
   *  SMTP bleibt der ganze Magic-Link-Abschnitt weg statt eines Buttons, der
   *  nur einen Fehler produzieren könnte. */
  mailConfigured: boolean;
  /** Aus `?error=` nach einem fehlgeschlagenen Code-Versuch (`auth.config.ts`s
   *  `pages.error`) — die Seite landet dabei neu, jeder Client-State ist weg. */
  initialError?: string;
}

/**
 * Anmelden — und, für eine unbekannte Adresse, zugleich das Konto anlegen:
 * `next-auth/webauthn` entscheidet serverseitig selbst, ob die E-Mail schon
 * einen Passkey hat (dann Anmeldung) oder nicht (dann Registrierung). Ein
 * eigenes Registrierungsformular gibt es deshalb nicht mehr.
 *
 * Drei unabhängige Wege, jeder nur sichtbar, wenn er auch funktioniert:
 * Passkey (immer — ohne E-Mail-Feld, der Browser zeigt die hinterlegten
 * Passkeys selbst an), Magic Link (nur mit SMTP), Single Sign-On (nur mit
 * konfigurierten Anbietern, über `AuthCard`s eingebauten OAuth-Abschnitt).
 */
export function LoginForm({
  callbackUrl,
  oauthProviders = [],
  oidcLabel,
  oidcHost,
  mailConfigured,
  initialError,
}: LoginFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [isMagicPending, startMagicTransition] = useTransition();

  // Die Code-Eingabe passiert auf einer eigenen Seite (`/login/verify`), nicht
  // mehr inline unter diesem Button — der Wechsel dorthin behält die
  // eingegebene E-Mail bei, ohne sie hier zusätzlich im Client-State zu halten.
  const sendMagic = () => {
    setError("");
    startMagicTransition(async () => {
      const result = await sendMagicLink(email, callbackUrl);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const params = new URLSearchParams({
        email: email.trim().toLowerCase(),
      });
      if (callbackUrl) params.set("callbackUrl", callbackUrl);
      router.push(`/login/verify?${params}`);
    });
  };

  return (
    <AuthCard
      title={t("login.signInTitle")}
      error={error}
      oauthProviders={oauthProviders}
      oauthLabels={oidcLabel ? { oidc: oidcLabel } : undefined}
      oauthHosts={oidcHost ? { oidc: oidcHost } : undefined}
    >
      <PasskeyLoginButton callbackUrl={callbackUrl} onError={setError} />

      {mailConfigured && (
        <>
          <div className={styles.divider}>{t("login.orMagicLink")}</div>
          <div className={styles.group}>
            <Input
              id="auth-email"
              label={t("login.workEmail")}
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              disabled={isMagicPending}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMagic()}
            />
            <Button
              type="button"
              variant="outline"
              size="lg"
              full
              disabled={isMagicPending || !email.trim()}
              icon={<Icon icon="lucide:mail" width={16} />}
              onClick={sendMagic}
            >
              {t("login.sendMagicLink")}
            </Button>
          </div>
        </>
      )}
    </AuthCard>
  );
}
