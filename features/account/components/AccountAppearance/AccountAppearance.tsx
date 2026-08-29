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
 * How the app looks and what language it speaks.
 *
 * No save button: every choice takes visible effect immediately, and a button
 * confirming an effect that already happened would confuse more than it
 * helps. Writing happens in the same step — the attributes go on the
 * document, the choice into the database, so it applies again next time and
 * on the next device.
 *
 * The language doesn't go through the database, but through the address: it's
 * the first segment in the path, and next-intl remembers the choice in a
 * cookie. Two places for the same piece of information would be two truths
 * that could drift apart.
 */
export function AccountAppearance({ theme }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [, startTransition] = useTransition();

  const [currentTheme, setCurrentTheme] = useState<Theme>(theme);

  /**
   * The chosen theme, on the document.
   *
   * Exactly the value the root layout also writes — "system" is deliberately
   * not resolved to "dark"/"light" here, CSS does that
   * (`styles/colors.scss`). Touching the document directly is just getting
   * ahead of the server's response: until `updateAppearance` returns and the
   * layout re-renders, the old theme would otherwise still be showing.
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
