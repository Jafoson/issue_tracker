"use client";

import { useEffect, useRef, useState } from "react";

export interface InfinitePage<T> {
  items: T[];
  nextCursor: string | null;
}

interface Options<T> {
  initialItems: T[];
  initialCursor: string | null;
  loadMore: (cursor: string) => Promise<InfinitePage<T>>;
}

/**
 * Loads further pages as soon as the edge at the end of a table comes into
 * view — the one place for the pattern that would otherwise look the same
 * in every table with infinite scroll. `sentinelRef` belongs on a
 * `LoadMoreSentinel` right after the table.
 *
 * If a view filters or sorts the loaded rows (`useTableSort`, its own
 * client-side filters), it does so on `items` — on what's already there,
 * not on some imaginary total set.
 */
export function useInfiniteScroll<T>({
  initialItems,
  initialCursor,
  loadMore,
}: Options<T>) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLOutputElement>(null);

  // Resets loaded pages as soon as the server sends new initial rows —
  // after a `router.refresh()` from a row action (delete, edit), the list
  // would otherwise keep showing the state from before the action, because
  // `useState` only reads its initial value on mount.
  useEffect(() => {
    setItems(initialItems);
    setCursor(initialCursor);
  }, [initialItems, initialCursor]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !cursor) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setLoading(true);
        loadMore(cursor).then((page) => {
          setItems((prev) => [...prev, ...page.items]);
          setCursor(page.nextCursor);
          setLoading(false);
        });
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  return { items, cursor, loading, sentinelRef };
}
