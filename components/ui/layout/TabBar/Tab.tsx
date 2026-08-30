"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import styles from "./tabBar.module.scss";
import type { TabMeta } from "./tabMeta";

interface TabProps {
  meta: TabMeta;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

// Renders a single tab. Pure UI + interaction — the state lives in
// TabBarClient, only the derived metadata and callbacks arrive here.
export function Tab({ meta, isActive, onSelect, onClose }: TabProps) {
  const t = useTranslations();
  const { title, color, icon, image } = meta;

  return (
    // Deliberately a <div role="tab">: the tab contains a close <button>,
    // a <button> as the root would be invalid HTML.
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      // The title gets truncated past ~200px — as a tooltip it stays readable.
      title={title}
      className={`${styles.tab}${isActive ? ` ${styles.active}` : ""}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {color ? (
        <Avatar
          avatar={{ name: title, color, image: image ?? undefined }}
          shape="square"
          size={14}
        />
      ) : (
        <Icon
          icon={icon ?? "lucide:layout-dashboard"}
          width={14}
          className={styles.icon}
        />
      )}
      <span className={styles.label}>{title}</span>
      <button
        type="button"
        className={styles.close}
        aria-label={t("actions.closeTab")}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <Icon icon="lucide:x" width={11} />
      </button>
    </div>
  );
}
