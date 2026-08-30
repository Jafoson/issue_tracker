"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { forwardRef } from "react";
import styles from "./loadMoreSentinel.module.scss";

/**
 * The edge at the end of a table with infinite scroll — visible only while
 * loading, so it doesn't look like an empty last row. `ref` belongs to
 * `useInfiniteScroll` (`sentinelRef`); the table only renders this element
 * as long as its `cursor` still has something left to load.
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
