"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";

export type SortKey = "priority" | "status" | "updated" | "created" | "title" | "assignee";

export function useTopbar() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { locale, workspace } = useParams<{ locale: string; workspace: string }>();
  const base = `/${locale}/${workspace}`;

  const showFilters = pathname.startsWith(`${base}/project/`);
  const showSort    = pathname.startsWith(`${base}/project/`) && pathname.endsWith("/list");

  const f = {
    statuses:   searchParams.get("status")?.split(",").filter(Boolean)                           ?? [],
    priorities: searchParams.get("priority")?.split(",").map(Number).filter((n) => !isNaN(n))   ?? [],
    assignees:  searchParams.get("assignee")?.split(",").filter(Boolean)                         ?? [],
    labels:     searchParams.get("label")?.split(",").filter(Boolean)                            ?? [],
  };
  const filterCount = f.statuses.length + f.priorities.length + f.assignees.length + f.labels.length;
  const sortKey     = (searchParams.get("sort") ?? "priority") as SortKey;

  function pushParams(updater: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(searchParams.toString());
    updater(p);
    startTransition(() => router.push(`${pathname}?${p.toString()}`, { scroll: false }));
  }

  function toggleFilter(key: string, value: string | number) {
    pushParams((p) => {
      const cur  = p.get(key)?.split(",").filter(Boolean) ?? [];
      const str  = String(value);
      const next = cur.includes(str) ? cur.filter((v) => v !== str) : [...cur, str];
      if (next.length) p.set(key, next.join(",")); else p.delete(key);
    });
  }

  function clearFilter(key: string) {
    pushParams((p) => p.delete(key));
  }

  function clearAll() {
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  return {
    router,
    pathname,
    isPending,
    showFilters,
    showSort,
    f,
    filterCount,
    sortKey,
    pushParams,
    toggleFilter,
    clearFilter,
    clearAll,
  };
}
