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
 * Lädt weitere Seiten nach, sobald der Rand am Ende einer Tabelle ins Bild
 * kommt — die eine Stelle für das Muster, das sonst in jeder Tabelle mit
 * Infinite Scroll gleich aussähe. `sentinelRef` gehört auf ein
 * `LoadMoreSentinel` direkt nach der Tabelle.
 *
 * Filtert oder sortiert eine Ansicht die geladenen Zeilen (`useTableSort`,
 * eigene Client-Filter), tut sie das auf `items` — auf dem, was bereits da
 * ist, nicht auf einer imaginären Gesamtmenge.
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

  // Setzt geladene Seiten zurück, sobald der Server neue Erstzeilen schickt —
  // nach `router.refresh()` einer Zeilenaktion (löschen, ändern) sonst
  // zeigte die Liste weiter den Stand von vor der Aktion, weil `useState`
  // seinen Startwert nur beim Mounten liest.
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
