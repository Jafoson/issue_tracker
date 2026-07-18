import { useTranslations } from "next-intl";
import type { PlatformStats } from "@/features/admin/queries";
import styles from "./platformOverview.module.scss";
import AdminOverviewCard, { AdminOverviewCardProps } from "./components/Card";

interface Props {
  stats: PlatformStats;
}

export function PlatformOverview({ stats }: Props) {
  const t = useTranslations();

  const cards: AdminOverviewCardProps[] = [
    {
      icon: "lucide:building-2",
      label: t("platform.workspaces"),
      value: stats.workspaces,
    },
    { icon: "lucide:users", label: t("platform.users"), value: stats.users },
    {
      icon: "lucide:folders",
      label: t("platform.projects"),
      value: stats.projects,
    },
  ];

  return (
    <div className={styles.wrap}>
      <h2 className={styles.pageTitle}>{t("platform.overview")}</h2>
      <p className={styles.subtitle}>{t("platform.overviewDesc")}</p>

      <div className={styles.grid}>
        {cards.map((c) => (
          <AdminOverviewCard card={c} key={c.label}/>
        ))}
      </div>
    </div>
  );
}
