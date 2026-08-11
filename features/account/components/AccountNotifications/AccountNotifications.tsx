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
 * Wovon man erfahren will — und auf welchem Weg.
 *
 * Fünf Anlässe, zwei Kanäle: die Zeile sagt, was passiert ist, die Spalte, wo es
 * ankommt. Als Matrix und nicht als zehn einzelne Zeilen, weil die Frage „und
 * auch per Mail?" zu jedem Anlass dieselbe ist — nebeneinander ist sie mit einem
 * Blick zu beantworten.
 *
 * Jeder Schalter gilt sofort und für sich. Der Zustand bleibt hier im Browser,
 * die Aktion schreibt im Hintergrund: ein Schalter, der erst nach der Antwort
 * des Servers umspringt, fühlt sich klemmend an. Geht das Schreiben schief,
 * springt er zurück und die Seite sagt warum.
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
        // Der Kopf der Spalte sagt den Kanal, die Zeile den Anlass — für einen
        // Screenreader steht beides nur zusammen am Schalter selbst.
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

        {/* Es gibt noch keinen Mailversand. Das gehört an die Stelle, an der
            jemand gerade einen Haken für Mail setzt — nicht in eine Fußnote,
            die niemand liest. */}
        <p className={styles.note}>
          <Icon icon="lucide:info" width={14} />
          {t("account.mailNote")}
        </p>
      </SettingsBody>
    </>
  );
}
