"use client";

import { Icon } from "@iconify/react";
import type { PlatformStats } from "@/features/admin/queries";
import { useTranslations } from "@/lib/translations-context";
import styles from "./platformOverview.module.scss";

interface Props {
  stats: PlatformStats;
}

export function PlatformOverview({ stats }: Props) {
  const t = useTranslations();

  const cards = [
    {
      icon: "lucide:building-2",
      label: t.platform.workspaces,
      value: stats.workspaces,
    },
    { icon: "lucide:users", label: t.platform.users, value: stats.users },
    {
      icon: "lucide:folders",
      label: t.platform.projects,
      value: stats.projects,
    },
  ];

  return (
    <div className={styles.wrap}>
      <h2 className={styles.pageTitle}>{t.platform.overview}</h2>
      <p className={styles.subtitle}>{t.platform.overviewDesc}</p>

      <div className={styles.grid}>
        {cards.map((c) => (
          <div key={c.label} className={styles.card}>
            <div className={styles.cardIcon}>
              <Icon icon={c.icon} width={20} />
            </div>
            <div className={styles.cardValue}>{c.value}</div>
            <div className={styles.cardLabel}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
