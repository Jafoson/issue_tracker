"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import {
  SettingsBody,
  SettingsList,
  type SettingsRow,
} from "@/components/ui/layout/SettingsList/SettingsList";
import { changePassword } from "@/features/account/actions";
import type { AccountSecurityView } from "@/features/account/types";
import { Link, useRouter } from "@/i18n/navigation";
import styles from "./accountSecurity.module.scss";

interface Props extends AccountSecurityView {
  /** Weg zu den verbundenen Konten — der Pfad kennt den Workspace, diese
   *  Komponente nicht. */
  connectionsHref: string;
}

/**
 * Womit man hereinkommt.
 *
 * Drei Auskünfte und ein Vorgang: das Passwort. Wer über GitHub oder Google
 * gekommen ist, hat noch keines — dann heißt der Knopf „Passwort festlegen" und
 * das Formular fragt nur nach dem neuen. Wer eines hat, muss es nennen: eine
 * offene Sitzung an einem fremden Rechner soll nicht genügen, um den Zugang zu
 * übernehmen. Geprüft wird das ohnehin im Server (`changePassword`); das
 * Formular macht die Regel nur sichtbar.
 *
 * Was hier fehlt, fehlt bewusst: eine neue E-Mail-Adresse ließe sich ohne
 * Mailversand nicht bestätigen, und „überall abmelden" wäre ein Knopf ohne
 * Wirkung — die Sitzung steckt in einem signierten Token, das der Server nicht
 * zurückrufen kann.
 */
export function AccountSecurity({
  email,
  emailVerified,
  hasPassword,
  connectedProviders,
  connectionsHref,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const close = () => {
    setOpen(false);
    setCurrent("");
    setNext("");
    setRepeat("");
    setError("");
  };

  const submit = () => {
    if (next !== repeat) {
      setError(t("account.passwordMismatch"));
      return;
    }

    startTransition(async () => {
      const result = await changePassword({ current, next });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      close();
      setDone(true);
      router.refresh();
    });
  };

  const password: SettingsRow[] = [
    {
      id: "password",
      label: t("fields.password"),
      desc: hasPassword
        ? t("account.passwordDesc")
        : t("account.passwordNoneDesc"),
      control: done ? (
        <span className={styles.saved}>
          <Icon icon="lucide:check" width={14} />
          {t("account.passwordChanged")}
        </span>
      ) : (
        <Button
          variant="outline"
          disabled={open}
          onClick={() => {
            setDone(false);
            setOpen(true);
          }}
        >
          {hasPassword ? t("account.changePassword") : t("account.setPassword")}
        </Button>
      ),
    },
  ];

  const login: SettingsRow[] = [
    {
      id: "email",
      label: t("fields.email"),
      desc: t("account.emailLoginDesc"),
      control: (
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
        <SettingsList title={t("fields.password")} rows={password} />

        {/* Das Formular steht unter der Zeile, die es geöffnet hat — nicht in
            einem Dialog: es gehört zu dieser Einstellung, und nichts daran
            verlangt, den Rest der Seite zu verdecken. */}
        {open && (
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {hasPassword && (
              <Input
                variant="password"
                label={t("account.currentPassword")}
                value={current}
                autoComplete="current-password"
                disabled={isPending}
                onChange={(e) => setCurrent(e.target.value)}
              />
            )}
            <Input
              variant="password"
              label={t("account.newPassword")}
              hint={t("account.passwordHint")}
              value={next}
              autoComplete="new-password"
              disabled={isPending}
              onChange={(e) => setNext(e.target.value)}
            />
            <Input
              variant="password"
              label={t("account.repeatPassword")}
              value={repeat}
              autoComplete="new-password"
              disabled={isPending}
              onChange={(e) => setRepeat(e.target.value)}
            />

            {error && (
              <p className={styles.error} role="alert">
                <Icon icon="lucide:circle-alert" width={14} />
                {error}
              </p>
            )}

            <div className={styles.actions}>
              <Button variant="text" type="button" onClick={close}>
                {t("actions.cancel")}
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={isPending || !next || !repeat}
              >
                {t("actions.save")}
              </Button>
            </div>
          </form>
        )}

        <SettingsList title={t("account.signIn")} rows={login} />
      </SettingsBody>
    </>
  );
}
