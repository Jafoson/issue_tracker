"use client";

import { Icon } from "@iconify/react";
import { signIn } from "next-auth/webauthn";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { OptionButton } from "@/components/ui/atoms/OptionButton/OptionButton";
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
  /** Ob `next-auth/providers/nodemailer` aktiv ist (`isMailConfigured()`,
   *  server-only — deshalb als fertiger Wert von der Seite gereicht). Ohne
   *  SMTP bleibt der ganze Magic-Link-Abschnitt weg — Passkey-Login und
   *  -Registrierung brauchen kein SMTP und stehen unabhängig davon oben. */
  mailConfigured: boolean;
  /** Aus `?error=` nach einem fehlgeschlagenen Code-Versuch (`auth.config.ts`s
   *  `pages.error`) — die Seite landet dabei neu, jeder Client-State ist weg. */
  initialError?: string;
}

/**
 * Anmelden — und, für ein neues Konto, zugleich registrieren.
 *
 * Drei Blöcke von oben nach unten, jeder nur sichtbar, wenn er auch
 * funktioniert:
 *
 * 1. Passkey — immer da, zwei Knöpfe: anmelden (`PasskeyLoginButton`, rein
 *    discoverable, der Browser zeigt die auf diesem Gerät hinterlegten
 *    Passkeys selbst an) oder registrieren (`registerWithPasskey`, legt ein
 *    komplett neues Konto an, siehe dort für die technische Notwendigkeit
 *    einer intern erzeugten Adresse).
 * 2. Magic Link — nur mit SMTP, sonst bleibt der ganze Block weg.
 * 3. Single Sign-On — nur mit konfigurierten Anbietern, über `AuthCard`s
 *    eingebauten OAuth-/OIDC-Abschnitt.
 */
export function LoginForm({
  callbackUrl,
  oauthProviders = [],
  oidcLabel,
  mailConfigured,
  initialError,
}: LoginFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [isMagicPending, startMagicTransition] = useTransition();
  const [isPasskeyPending, startPasskeyTransition] = useTransition();

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

  // `@auth/core`s WebAuthn-Ablauf verlangt für eine Registrierung intern
  // immer eine `email` — ein WebAuthn-Credential braucht laut Spezifikation
  // einen `userName`, den der Passkey-Manager anzeigt. Diese Adresse wird nie
  // angezeigt oder abgefragt, nur einmalig hier erzeugt und dient rein der
  // Ceremony; `createAdapter().createUser` (`auth.ts`s
  // `NO_EMAIL_SENTINEL_DOMAIN`) verwirft sie sofort wieder und legt das Konto
  // mit `email: null` an.
  const registerWithPasskey = () => {
    setError("");
    startPasskeyTransition(async () => {
      try {
        await signIn("webauthn", {
          email: `${crypto.randomUUID()}@no-email.invalid`,
          redirectTo: callbackUrl || "/",
        });
      } catch {
        setError(t("login.passkeyFailed"));
      }
    });
  };

  return (
    <AuthCard
      title={t("login.signInTitle")}
      error={error}
      oauthProviders={oauthProviders}
      oauthLabels={oidcLabel ? { oidc: oidcLabel } : undefined}
    >
      <div className={styles.group}>
        <PasskeyLoginButton callbackUrl={callbackUrl} onError={setError} />
        <OptionButton
          variant="outline"
          disabled={isPasskeyPending}
          icon={<Icon icon="lucide:user-plus" width={18} />}
          title={t("login.registerWithPasskey")}
          onClick={registerWithPasskey}
        />
      </div>

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
