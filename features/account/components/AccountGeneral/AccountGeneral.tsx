"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { ColorPicker } from "@/components/ui/atoms/ColorPicker/ColorPicker";
import { Input } from "@/components/ui/atoms/Input/Input";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import {
  SettingsBody,
  SettingsList,
  type SettingsRow,
} from "@/components/ui/layout/SettingsList/SettingsList";
import { updateProfile } from "@/features/account/actions";
import type { AccountProfileView } from "@/features/account/types";
import { useRouter } from "@/i18n/navigation";
import styles from "./accountGeneral.module.scss";

interface Props {
  profile: AccountProfileView;
}

/**
 * Wer man ist: Name, Benutzername, Farbe — und die Adresse, unter der man sich
 * anmeldet.
 *
 * Vier Felder, ein Speichern-Knopf im Seitenkopf. Wer seinen Namen ändert, sieht
 * meist auch den Rest durch; vier eigene Knöpfe wären vier Runden zum Server für
 * einen Vorgang, den man als einen empfindet.
 *
 * Die E-Mail-Adresse steht dabei nur da: sie ist der Anmeldename, und ohne
 * Mailversand gäbe es keinen Weg, eine neue zu bestätigen. Die Zeile sagt das
 * und verweist auf „Sicherheit", wo alles Übrige zur Anmeldung steht.
 */
export function AccountGeneral({ profile }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [handle, setHandle] = useState(profile.handle);
  const [color, setColor] = useState(profile.color);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const dirty =
    firstName.trim() !== profile.firstName ||
    lastName.trim() !== profile.lastName ||
    handle.trim() !== profile.handle ||
    color !== profile.color;

  const complete = Boolean(
    firstName.trim() && lastName.trim() && handle.trim(),
  );

  const touch = () => setSaved(false);

  const save = () =>
    startTransition(async () => {
      const result = await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        handle: handle.trim(),
        color,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError("");
      setSaved(true);
      router.refresh();
    });

  const identity: SettingsRow[] = [
    {
      id: "firstName",
      label: t("account.firstName"),
      desc: t("account.nameDesc"),
      control: (
        <div className={styles.control}>
          <Input
            aria-label={t("account.firstName")}
            value={firstName}
            disabled={isPending}
            onChange={(e) => {
              setFirstName(e.target.value);
              touch();
            }}
          />
        </div>
      ),
    },
    {
      id: "lastName",
      label: t("account.lastName"),
      desc: t("account.lastNameDesc"),
      control: (
        <div className={styles.control}>
          <Input
            aria-label={t("account.lastName")}
            value={lastName}
            disabled={isPending}
            onChange={(e) => {
              setLastName(e.target.value);
              touch();
            }}
          />
        </div>
      ),
    },
    {
      id: "handle",
      label: t("account.handle"),
      desc: t("account.handleDesc"),
      control: (
        <div className={styles.control}>
          <Input
            aria-label={t("account.handle")}
            value={handle}
            disabled={isPending}
            iconLeft={<span className={styles.at}>@</span>}
            onChange={(e) => {
              setHandle(e.target.value);
              touch();
            }}
          />
        </div>
      ),
    },
    {
      id: "color",
      label: t("fields.color"),
      desc: t("account.colorDesc"),
      control: (
        <div className={styles.control}>
          <ColorPicker
            size="sm"
            value={color}
            onChange={(next) => {
              setColor(next);
              touch();
            }}
          />
        </div>
      ),
    },
  ];

  const login: SettingsRow[] = [
    {
      id: "email",
      label: t("fields.email"),
      desc: t("account.emailDesc"),
      control: <span className={styles.value}>{profile.email}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        divider={false}
        // Der Avatar zeigt die gewählte Farbe sofort — noch bevor gespeichert
        // ist, denn genau das ist die Frage, die die Farbwahl beantwortet.
        leading={<Avatar avatar={{ firstName, lastName, color }} size={28} />}
        title={t("nav.general")}
        description={t("account.generalDesc")}
        actions={
          <>
            {/* Verschwindet, sobald wieder etwas geändert wird — die
                Bestätigung gehört zum abgeschlossenen Vorgang. */}
            {saved && !dirty && (
              <span className={styles.saved}>
                <Icon icon="lucide:check" width={14} />
                {t("projectSettings.saved")}
              </span>
            )}
            <Button
              variant="primary"
              disabled={!dirty || !complete || isPending}
              onClick={save}
            >
              {t("actions.save")}
            </Button>
          </>
        }
      />

      <SettingsBody>
        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}

        <SettingsList label={t("account.profile")} rows={identity} />
        <SettingsList title={t("account.signIn")} rows={login} />
      </SettingsBody>
    </>
  );
}
