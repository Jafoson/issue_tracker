"use client";

import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { SegmentedControl } from "@/components/ui/atoms/SegmentedControl/SegmentedControl";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import {
  SettingsBody,
  SettingsList,
  type SettingsRow,
} from "@/components/ui/layout/SettingsList/SettingsList";
import { updateAppearance } from "@/features/account/actions";
import type { Theme } from "@/features/account/types";
import { usePathname, useRouter } from "@/i18n/navigation";
import styles from "./accountAppearance.module.scss";

interface Props {
  theme: Theme;
}

/**
 * Wie die App aussieht und in welcher Sprache sie spricht.
 *
 * Ohne Speichern: jede Wahl wirkt sofort sichtbar, und ein Knopf, der eine schon
 * eingetretene Wirkung bestätigt, verwirrt mehr als er hilft. Geschrieben wird
 * im selben Zug — die Attribute stehen am Dokument, die Wahl in der Datenbank,
 * damit sie das nächste Mal und auf dem nächsten Gerät wieder gilt.
 *
 * Die Sprache läuft nicht über die Datenbank, sondern über die Adresse: sie
 * steht als erstes Segment im Pfad, und next-intl merkt sich die Wahl in einem
 * Cookie. Zwei Orte für dieselbe Angabe wären zwei Wahrheiten, die
 * auseinanderlaufen können.
 */
export function AccountAppearance({ theme }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [, startTransition] = useTransition();

  const [currentTheme, setCurrentTheme] = useState<Theme>(theme);

  /**
   * Das gewählte Design am Dokument.
   *
   * Genau der Wert, den auch das Wurzel-Layout schreibt — „system" wird hier
   * bewusst nicht zu „dark"/„light" aufgelöst, das macht CSS
   * (`styles/colors.scss`). Der Griff ans Dokument ist nur der Vorgriff auf die
   * Antwort des Servers: bis `updateAppearance` zurück ist und das Layout neu
   * gerendert wurde, stünde sonst noch das alte Design da.
   */
  const applyTheme = (value: Theme) => {
    setCurrentTheme(value);
    document.documentElement.dataset.theme = value;
    startTransition(() => {
      updateAppearance({ theme: value });
    });
  };

  const appearance: SettingsRow[] = [
    {
      id: "theme",
      label: t("settings.theme"),
      desc: t("settings.themeDesc"),
      control: (
        <SegmentedControl
          items={[
            {
              value: "dark",
              label: t("settings.dark"),
              icon: <Icon icon="lucide:moon" width={14} />,
            },
            {
              value: "light",
              label: t("settings.light"),
              icon: <Icon icon="lucide:sun" width={14} />,
            },
            {
              value: "system",
              label: t("account.system"),
              icon: <Icon icon="lucide:monitor" width={14} />,
            },
          ]}
          value={currentTheme}
          onChange={(v) => applyTheme(v as Theme)}
        />
      ),
    },
  ];

  const language: SettingsRow[] = [
    {
      id: "language",
      label: t("settings.language"),
      desc: t("settings.languageDesc"),
      control: (
        <SegmentedControl
          items={[
            { value: "de", label: "Deutsch" },
            { value: "en", label: "English" },
          ]}
          value={locale}
          onChange={(v) =>
            router.replace(pathname, { locale: v as typeof locale })
          }
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.appearance")}
        description={t("account.appearanceDesc")}
      />

      <SettingsBody>
        <SettingsList title={t("settings.appearance")} rows={appearance} />
        <SettingsList title={t("account.language")} rows={language} />

        <p className={styles.note}>
          <Icon icon="lucide:info" width={14} />
          {t("account.appearanceNote")}
        </p>
      </SettingsBody>
    </>
  );
}
