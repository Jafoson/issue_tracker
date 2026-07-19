"use client";

import { Icon } from "@iconify/react";
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
  const { title, color, icon } = meta;

  return (
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      className={`${styles.tab}${isActive ? ` ${styles.active}` : ""}`}
      onClick={onSelect}
      onKeyDown={(e) =>
        e.key === "Enter" || e.key === " " ? onSelect() : undefined
      }
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
        aria-label="Close tab"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <Icon icon="lucide:x" width={10} />
      </button>
    </div>
  );
}
