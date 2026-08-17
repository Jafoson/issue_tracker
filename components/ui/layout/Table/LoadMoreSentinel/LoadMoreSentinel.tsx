"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { forwardRef } from "react";
import styles from "./loadMoreSentinel.module.scss";

/**
 * Der Rand am Ende einer Tabelle mit Infinite Scroll — sichtbar nur, während
 * geladen wird, damit er nicht wie eine leere letzte Zeile wirkt.
 * `ref` gehört an `useInfiniteScroll` (`sentinelRef`); die Tabelle rendert
 * dieses Element nur, solange dessen `cursor` noch etwas nachzuladen hat.
 */
export const LoadMoreSentinel = forwardRef<
  HTMLOutputElement,
  { loading: boolean }
>(function LoadMoreSentinel({ loading }, ref) {
  const t = useTranslations();
  return (
    <output ref={ref} className={styles.loadMore}>
      {loading && (
        <>
          <Icon icon="lucide:loader-2" width={16} className={styles.icon} />
          {t("a11y.loadingMore")}
        </>
      )}
    </output>
  );
});
