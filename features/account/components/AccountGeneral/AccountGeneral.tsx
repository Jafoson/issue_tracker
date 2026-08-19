"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { AvatarUploader } from "@/components/ui/atoms/AvatarUploader/AvatarUploader";
import { Button } from "@/components/ui/atoms/Button/Button";
import { ColorPicker } from "@/components/ui/atoms/ColorPicker/ColorPicker";
import { Input } from "@/components/ui/atoms/Input/Input";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { SettingsIdentity } from "@/components/ui/layout/SettingsIdentity/SettingsIdentity";
import {
  SettingsBody,
  SettingsList,
  type SettingsRow,
} from "@/components/ui/layout/SettingsList/SettingsList";
import {
  confirmAvatarUpload,
  removeAvatar,
  requestAvatarUploadUrl,
  updateProfile,
} from "@/features/account/actions";
import type { AccountProfileView } from "@/features/account/types";
import { useRouter } from "@/i18n/navigation";
import styles from "./accountGeneral.module.scss";

interface Props {
  profile: AccountProfileView;
}

/**
 * Der Benutzername entsteht so, wie er gespeichert wird.
 *
 * `updateProfile` prüft gegen `^[a-z0-9][a-z0-9-]{1,29}$` und antwortet sonst
 * mit einem Fehler oben auf der Seite — weit weg vom Feld und erst nach dem
 * Speichern. Wer stattdessen gar nichts Unerlaubtes eintippen kann, bekommt die
 * Regel im Moment der Eingabe zu sehen: Großbuchstaben werden klein, Leer- und
 * Trennzeichen zu Bindestrichen, alles Übrige fällt weg.
 */
const toHandle = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[\s._]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 30);

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

  // Benutzername und Vorname sind Pflicht, Nachname optional
  // (`features/onboarding`).
  const complete = Boolean(handle.trim() && firstName.trim());

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

  const login: SettingsRow[] = [
    {
      id: "email",
      label: t("fields.email"),
      desc: t("account.emailDesc"),
      control: (
        <span className={styles.value}>
          {profile.email ?? t("account.noEmail")}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        divider={false}
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

        <SettingsIdentity
          avatar={
            <AvatarUploader
              avatar={{
                firstName,
                lastName,
                color,
                handle,
                image: profile.avatarUrl ?? undefined,
              }}
              shape="square"
              disabled={isPending}
              removeLabel={t("account.removeAvatar")}
              onRequestUpload={requestAvatarUploadUrl}
              onConfirmUpload={confirmAvatarUpload}
              onRemove={removeAvatar}
              onDone={() => router.refresh()}
            />
          }
        >
          <Input
            label={t("account.firstName")}
            value={firstName}
            disabled={isPending}
            onChange={(e) => {
              setFirstName(e.target.value);
              touch();
            }}
          />
          <Input
            label={t("account.lastName")}
            value={lastName}
            disabled={isPending}
            onChange={(e) => {
              setLastName(e.target.value);
              touch();
            }}
          />
          <Input
            label={t("account.handle")}
            value={handle}
            disabled={isPending}
            // Kein Symbol, sondern ein Vorsatz: das `@` steht unmittelbar vor
            // dem Namen und wird mit ihm als ein Wort gelesen.
            prefix="@"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={30}
            onChange={(e) => {
              setHandle(toHandle(e.target.value));
              touch();
            }}
          />
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("fields.color")}</span>
            <ColorPicker
              value={color}
              onChange={(next) => {
                setColor(next);
                touch();
              }}
            />
          </div>
        </SettingsIdentity>

        <SettingsList title={t("account.signIn")} rows={login} />
      </SettingsBody>
    </>
  );
}
