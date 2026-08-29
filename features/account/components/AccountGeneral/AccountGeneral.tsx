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
 * The username comes into being the same way it's stored.
 *
 * `updateProfile` validates against `^[a-z0-9][a-z0-9-]{1,29}$` and otherwise
 * responds with an error at the top of the page — far from the field and only
 * after saving. Instead, if it's never possible to type anything disallowed
 * in the first place, the rule becomes visible the moment you type:
 * uppercase becomes lowercase, spaces and separators become hyphens,
 * everything else is dropped.
 */
const toHandle = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[\s._]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 30);

/**
 * Who you are: name, username, color — and the address you sign in with.
 *
 * Four fields, one save button in the page header. Anyone changing their name
 * usually reviews the rest too; four separate buttons would mean four round
 * trips to the server for something that feels like a single action.
 *
 * The email address is just displayed there: it's the sign-in name, and
 * without mail sending there'd be no way to verify a new one. The row states
 * that and points to "Security", where everything else about signing in
 * lives.
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

  // Username and first name are required, last name optional
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
            {/* Disappears as soon as something changes again — the
                confirmation belongs to the completed action. */}
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
            // Not a symbol, but a prefix: the `@` sits immediately before
            // the name and is read together with it as one word.
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
