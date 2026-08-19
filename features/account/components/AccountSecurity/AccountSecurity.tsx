"use client";

import { Icon } from "@iconify/react";
import { signIn } from "next-auth/webauthn";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import {
  SettingsBody,
  SettingsList,
  type SettingsRow,
} from "@/components/ui/layout/SettingsList/SettingsList";
import { addEmail, removePasskey } from "@/features/account/actions";
import type { AccountSecurityView } from "@/features/account/types";
import { Link } from "@/i18n/navigation";
import styles from "./accountSecurity.module.scss";

interface Props extends AccountSecurityView {
  /** Weg zu den verbundenen Konten — der Pfad kennt den Workspace, diese
   *  Komponente nicht. */
  connectionsHref: string;
}

/**
 * Womit man hereinkommt.
 *
 * Kein Passwort mehr — Passkeys und verbundene Anbieter sind die einzigen
 * Wege. Die Ceremony (Browser-Prompt) übernimmt `next-auth/webauthn`s
 * `signIn` vollständig, der letzte-Weg-hinein-Schutz steckt im Server
 * (`removePasskey`); die Oberfläche macht die Regel nur sichtbar.
 *
 * Was hier fehlt, fehlt bewusst: eine bestehende Adresse zu *ändern* ließe
 * sich ohne Mailversand nicht bestätigen (siehe `addEmail`), und „überall
 * abmelden" wäre ein Knopf ohne Wirkung — die Sitzung steckt in einem
 * signierten Token, das der Server nicht zurückrufen kann. Eine ganz neue
 * Adresse *hinzufügen* (Passkey-Konto ohne Adresse) geht dagegen — dafür
 * gibt es noch nichts zu bestätigen, das kaputtgehen könnte.
 */
export function AccountSecurity({
  email,
  emailVerified,
  connectedProviders,
  connectionsHref,
  passkeys,
}: Props) {
  const t = useTranslations();
  const format = useFormatter();

  const [passkeyError, setPasskeyError] = useState("");
  const [isPasskeyPending, startPasskeyTransition] = useTransition();

  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isEmailPending, startEmailTransition] = useTransition();

  const submitEmail = () => {
    setEmailError("");
    startEmailTransition(async () => {
      const result = await addEmail(newEmail);
      if ("error" in result) {
        setEmailError(result.error);
        return;
      }
      setNewEmail("");
    });
  };

  const addPasskey = () => {
    setPasskeyError("");
    startPasskeyTransition(async () => {
      try {
        await signIn("webauthn", { action: "register", redirect: true });
      } catch {
        setPasskeyError(t("account.passkeyAddFailed"));
      }
    });
  };

  const removePasskeyRow = (credentialID: string) =>
    startPasskeyTransition(async () => {
      const result = await removePasskey(credentialID);
      if ("error" in result) {
        setPasskeyError(result.error);
        return;
      }
      setPasskeyError("");
    });

  const passkeyRows: SettingsRow[] = [
    ...passkeys.map((passkey) => ({
      id: passkey.credentialID,
      label:
        passkey.deviceType === "multiDevice"
          ? t("account.passkeySynced")
          : t("account.passkeyDevice"),
      desc: t("account.passkeyAddedOn", {
        date: format.dateTime(passkey.createdAt, { dateStyle: "medium" }),
      }),
      control: (
        <Button
          variant="text"
          disabled={isPasskeyPending}
          onClick={() => removePasskeyRow(passkey.credentialID)}
        >
          {t("actions.remove")}
        </Button>
      ),
    })),
    {
      id: "add-passkey",
      label: t("account.addPasskey"),
      desc: t("account.addPasskeyDesc"),
      control: (
        <Button
          variant="outline"
          disabled={isPasskeyPending}
          icon={<Icon icon="lucide:fingerprint" width={14} />}
          onClick={addPasskey}
        >
          {t("account.addPasskey")}
        </Button>
      ),
    },
  ];

  const login: SettingsRow[] = [
    {
      id: "email",
      label: t("fields.email"),
      desc: email ? t("account.emailLoginDesc") : t("account.addEmailDesc"),
      control: email ? (
        <span className={styles.status}>
          <span className={styles.value}>{email}</span>
          {emailVerified ? (
            <span className={styles.verified}>
              <Icon icon="lucide:badge-check" width={14} />
              {t("account.emailVerified")}
            </span>
          ) : (
            <span className={styles.unverified}>
              <Icon icon="lucide:clock" width={14} />
              {t("account.emailUnverified")}
            </span>
          )}
        </span>
      ) : (
        <span className={styles.addEmail}>
          <Input
            aria-label={t("fields.email")}
            inputMode="email"
            placeholder="you@example.com"
            value={newEmail}
            disabled={isEmailPending}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitEmail()}
          />
          <Button
            variant="outline"
            disabled={isEmailPending || !newEmail.trim()}
            onClick={submitEmail}
          >
            {t("account.addEmail")}
          </Button>
        </span>
      ),
    },
    {
      id: "providers",
      label: t("nav.connections"),
      desc: t("account.providersDesc"),
      control: (
        <Link href={connectionsHref} className={styles.link}>
          {connectedProviders.length === 0
            ? t("account.noProviders")
            : t("account.providerCount", { count: connectedProviders.length })}
          <Icon icon="lucide:arrow-right" width={14} />
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.security")}
        description={t("account.securityDesc")}
      />

      <SettingsBody>
        <SettingsList title={t("account.passkeys")} rows={passkeyRows} />
        {passkeyError && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {passkeyError}
          </p>
        )}

        <SettingsList title={t("account.signIn")} rows={login} />
        {emailError && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {emailError}
          </p>
        )}
      </SettingsBody>
    </>
  );
}
