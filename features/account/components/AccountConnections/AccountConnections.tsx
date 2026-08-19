"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import {
  SettingsBody,
  SettingsList,
  type SettingsRow,
} from "@/components/ui/layout/SettingsList/SettingsList";
import { disconnectAccount } from "@/features/account/actions";
import type { AccountConnectionsView } from "@/features/account/types";
import { signInWithOAuth } from "@/features/auth/actions";
import { useRouter } from "@/i18n/navigation";
import styles from "./accountConnections.module.scss";

/** Zeichen und Name der Anbieter — beides gehört zur Marke, nicht in die
 *  Übersetzungsdateien. */
const PROVIDERS: Record<string, { icon: string; name: string }> = {
  github: { icon: "lucide:github", name: "GitHub" },
  google: { icon: "logos:google-icon", name: "Google" },
};

/**
 * Die fremden Anmeldewege dieses Kontos.
 *
 * Jede Zeile ist ein Anbieter und hat genau einen Zustand: verbunden oder nicht.
 * Verbinden heißt sich dort anmelden — Auth.js hängt den Weg an das Konto, in
 * dem man gerade steckt, ein eigener Vorgang wäre es nicht.
 *
 * Der letzte Weg lässt sich nicht lösen. Wer keinen Passkey hat und nur ein
 * verbundenes Konto, käme danach nicht mehr herein. Der Knopf fehlt dann und
 * die Zeile sagt, warum — verboten wird es aber im Server
 * (`disconnectAccount`), denn eine ausgeblendete Schaltfläche ist keine
 * Sperre.
 */
export function AccountConnections({
  accounts,
  hasPasskey,
}: AccountConnectionsView) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const connectedCount = accounts.filter((a) => a.connected).length;

  const disconnect = (provider: string) =>
    startTransition(async () => {
      const result = await disconnectAccount(provider);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError("");
      router.refresh();
    });

  const rows: SettingsRow[] = accounts.map((account) => {
    const meta = PROVIDERS[account.provider];
    const name = account.label ?? meta?.name ?? account.provider;
    // Der letzte Weg hinein bleibt, wo er ist.
    const isLastWayIn = account.connected && !hasPasskey && connectedCount <= 1;

    return {
      id: account.provider,
      label: name,
      desc: !account.available
        ? t("account.providerUnavailable")
        : isLastWayIn
          ? t("account.lastMethod")
          : account.connected
            ? t("account.connectedDesc")
            : t("account.connectDesc", { provider: name }),
      control: (
        <span className={styles.control}>
          <Icon
            icon={meta?.icon ?? "lucide:link"}
            width={18}
            className={styles.mark}
          />
          {account.connected ? (
            <>
              <span className={styles.connected}>
                <Icon icon="lucide:check" width={14} />
                {t("account.connected")}
              </span>
              {!isLastWayIn && (
                <Button
                  variant="text"
                  disabled={isPending}
                  onClick={() => disconnect(account.provider)}
                >
                  {t("account.disconnect")}
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="outline"
              disabled={!account.available || isPending}
              onClick={() => signInWithOAuth(account.provider)}
            >
              {t("account.connect")}
            </Button>
          )}
        </span>
      ),
    };
  });

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.connections")}
        description={t("account.connectionsDesc")}
      />

      <SettingsBody>
        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}

        <SettingsList label={t("nav.connections")} rows={rows} />

        <p className={styles.note}>
          <Icon icon="lucide:info" width={14} />
          {hasPasskey
            ? t("account.connectionsNote")
            : t("account.connectionsNoteNoPassword")}
        </p>
      </SettingsBody>
    </>
  );
}
