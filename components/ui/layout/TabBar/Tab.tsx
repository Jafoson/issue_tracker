"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import styles from "./tabBar.module.scss";
import type { TabMeta } from "./tabMeta";

interface TabProps {
  meta: TabMeta;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

// Rendert einen einzelnen Tab. Reines UI + Interaktion — der Zustand liegt in
// TabBarClient, hier kommen nur die abgeleiteten Meta-Daten und Callbacks an.
export function Tab({ meta, isActive, onSelect, onClose }: TabProps) {
  const t = useTranslations();
  const { title, color, icon } = meta;

  return (
    // Bewusst ein <div role="tab">: der Tab enthält einen Close-<button>,
    // ein <button> als Wurzel wäre invalides HTML.
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      // Der Titel wird ab ~200px abgeschnitten — als Tooltip bleibt er lesbar.
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
        <span className={styles.dot} style={{ background: color }} />
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
