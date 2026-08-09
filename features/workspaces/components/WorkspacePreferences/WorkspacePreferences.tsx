"use client";

import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { SegmentedControl } from "@/components/ui/atoms/SegmentedControl/SegmentedControl";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import { usePathname, useRouter } from "@/i18n/navigation";
import { fullName } from "@/lib/utils/string";
import type { User } from "@/types";
import styles from "./workspacePreferences.module.scss";

interface Props {
  me: User;
}

interface SettingRow {
  id: string;
  label: string;
  desc: ReactNode;
  control: ReactNode;
}

const COLUMNS: TableColumn<SettingRow>[] = [
  {
    id: "setting",
    width: "minmax(0, 1fr)",
    cell: (row) => (
      <div className={styles.setting}>
        <span className={styles.label}>{row.label}</span>
        <span className={styles.desc}>{row.desc}</span>
      </div>
    ),
  },
  {
    id: "control",
    width: "minmax(280px, max-content)",
    align: "end",
    cell: (row) => row.control,
  },
];

/**
 * Was dem Benutzer gehört und nicht dem Workspace: Design, Sprache, das eigene
 * Konto.
 *
 * Steht im selben Rahmen wie die übrigen Bereiche, aber am Ende der Leiste —
 * alles darüber gilt für alle, das hier nur für den, der es einstellt. Der
 * Wechsel greift ohne Speichern: beides wirkt sofort sichtbar, und ein Knopf,
 * der eine schon eingetretene Wirkung bestätigt, verwirrt mehr als er hilft.
 */
export function WorkspacePreferences({ me }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  // Das Design steht als Attribut am Dokument — die Server-Fassung kennt es
  // nicht, deshalb wird es beim ersten Rendern im Browser nachgelesen.
  const [theme, setTheme] = useState<"dark" | "light">(
    typeof document !== "undefined"
      ? ((document.documentElement.getAttribute("data-theme") as
          | "dark"
          | "light") ?? "dark")
      : "dark",
  );

  const applyTheme = (value: "dark" | "light") => {
    setTheme(value);
    document.documentElement.setAttribute("data-theme", value);
  };

  const appearance: SettingRow[] = [
    {
      id: "theme",
      label: t("settings.theme"),
      desc: t("settings.themeDesc"),
      control: (
        <SegmentedControl
          items={[
            { value: "dark", label: t("settings.dark") },
            { value: "light", label: t("settings.light") },
          ]}
          value={theme}
          onChange={(v) => applyTheme(v as "dark" | "light")}
        />
      ),
    },
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

  const profile: SettingRow[] = [
    {
      id: "name",
      label: t("fields.name"),
      desc: t("workspacePreferences.nameDesc"),
      control: (
        <span className={styles.identity}>
          <Avatar avatar={me} size={28} />
          {fullName(me)}
        </span>
      ),
    },
    {
      id: "email",
      label: t("fields.email"),
      desc: t("workspacePreferences.emailDesc"),
      control: <span className={styles.value}>{me.email}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.preferences")}
        description={t("workspacePreferences.subtitle")}
      />

      <div className={styles.content}>
        <section className={styles.group}>
          <h2 className={styles.groupTitle}>{t("settings.appearance")}</h2>
          <Table
            variant="card"
            label={t("settings.appearance")}
            columns={COLUMNS}
            rows={appearance}
            getRowKey={(row) => row.id}
          />
        </section>

        <section className={styles.group}>
          <h2 className={styles.groupTitle}>{t("settings.profile")}</h2>
          <Table
            variant="card"
            label={t("settings.profile")}
            columns={COLUMNS}
            rows={profile}
            getRowKey={(row) => row.id}
          />
        </section>
      </div>
    </>
  );
}
