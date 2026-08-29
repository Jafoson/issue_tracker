"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/atoms/Switch/Switch";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import {
  SettingsBody,
  SettingsList,
  type SettingsRow,
} from "@/components/ui/layout/SettingsList/SettingsList";
import { setNotification } from "@/features/account/actions";
import {
  NOTIFICATION_EVENTS,
  type NotificationEvent,
  type NotificationKey,
  type NotificationSettings,
} from "@/features/account/types";
import styles from "./accountNotifications.module.scss";

interface Props {
  settings: NotificationSettings;
}

/**
 * What you want to hear about — and through which channel.
 *
 * Five occasions, two channels: the row says what happened, the column
 * where it arrives. As a matrix and not as ten individual rows, because
 * the question "and by email too?" is the same for every occasion — side by
 * side, it can be answered at a glance.
 *
 * Every toggle applies immediately and independently. The state stays here
 * in the browser, the action writes in the background: a toggle that only
 * flips after the server responds feels sluggish. If the write fails, it
 * snaps back and the page says why.
 */
export function AccountNotifications({ settings }: Props) {
  const t = useTranslations();
  const [values, setValues] = useState<NotificationSettings>(settings);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  const toggle = (key: NotificationKey, value: boolean) => {
    const previous = values[key];
    setValues((current) => ({ ...current, [key]: value }));
    setError("");

    startTransition(async () => {
      const result = await setNotification(key, value);
      if ("error" in result) {
        setValues((current) => ({ ...current, [key]: previous }));
        setError(result.error);
      }
    });
  };

  const cell = (event: NotificationEvent, channel: "InApp" | "Email") => {
    const key = `${event}${channel}` as NotificationKey;
    return (
      <Switch
        checked={values[key]}
        onChange={(next) => toggle(key, next)}
        // The column header states the channel, the row the occasion — for a
        // screen reader, both only exist together on the toggle itself.
        label={`${t(`account.event.${event}`)} — ${t(`account.channel.${channel}`)}`}
        labelHidden
      />
    );
  };

  const rows: SettingsRow[] = NOTIFICATION_EVENTS.map((event) => ({
    id: event,
    label: t(`account.event.${event}`),
    desc: t(`account.eventDesc.${event}`),
    cells: {
      inApp: cell(event, "InApp"),
      email: cell(event, "Email"),
    },
  }));

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.notifications")}
        description={t("account.notificationsDesc")}
      />

      <SettingsBody>
        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}

        <SettingsList
          label={t("nav.notifications")}
          rows={rows}
          columns={[
            { id: "inApp", header: t("account.channel.InApp") },
            { id: "email", header: t("account.channel.Email") },
          ]}
        />
      </SettingsBody>
    </>
  );
}
