"use client";

import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { useTranslations } from "next-intl";
import styles from "../sidebar.module.scss";

export function QuickActions() {
  const t = useTranslations();
  return (
    <div className={styles.quickActions}>
      <Button
        variant="primary"
        full
        icon={<Icon icon="lucide:plus" width={16} />}
        onClick={() =>
          (window as { __openComposer?: () => void }).__openComposer?.()
        }
      >
        {t("actions.newIssue")}
      </Button>
      <Button
        variant="outline"
        className={styles.search}
        size="md"
        onClick={() =>
          (window as { __openPalette?: () => void }).__openPalette?.()
        }
      >
        <Icon icon="lucide:search" width={15} />
        <span>{t("placeholders.search")}</span>
        <span className="kbd" style={{ marginLeft: "auto" }}>
          ⌘K
        </span>
      </Button>
    </div>
  );
}
