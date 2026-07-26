"use client";

import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  assigneeIdToSlug,
  assigneeSlugToId,
  labelIdToSlug,
  labelSlugToId,
  priorityIdToSlug,
  prioritySlugToId,
  statusIdToSlug,
  statusSlugToId,
} from "@/lib/filter-slugs";
import { useWorkspace } from "@/lib/workspace-context";

export type SortKey =
  | "priority"
  | "status"
  | "updated"
  | "created"
  | "title"
  | "assignee";

export type FilterKey = "status" | "priority" | "assignee" | "label";

export type View = "board" | "list";

export interface FilterState {
  status: string[];
  priority: number[];
  assignee: string[];
  label: string[];
}

/**
 * Owns the topbar's entire URL state: which filters are active, how the list is
 * sorted and which view is shown. The URL is the single source of truth — every
 * setter writes to it and the derived values are read straight back out.
 */
export function useTopbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { priorities, members, labels, projects, workspace } = useWorkspace();
  const base = `/${workspace.id}`;

  const showFilters = pathname.startsWith(`${base}/project/`);
  const view: View = pathname.endsWith("/list") ? "list" : "board";
  const showSort = showFilters && view === "list";

  const slug =
    pathname.match(new RegExp(`^${base}/project/([^/]+)`))?.[1] ??
    projects[0]?.slug ??
    "";
  const project = projects.find((p) => p.slug === slug) ?? projects[0] ?? null;

  // URL holds slugs; the UI works in internal-id space — translate on read.
  const parse = (key: FilterKey) =>
    searchParams.get(key)?.split(",").filter(Boolean) ?? [];

  const filters: FilterState = {
    status: parse("status").map(statusSlugToId),
    priority: parse("priority")
      .map((s) => prioritySlugToId(priorities, s))
      .filter((n): n is number => n !== undefined),
    assignee: parse("assignee")
      .map((s) => assigneeSlugToId(members, s))
      .filter((id): id is string => Boolean(id)),
    label: parse("label")
      .map((s) => labelSlugToId(labels, s))
      .filter((id): id is string => Boolean(id)),
  };

  const filterCount =
    filters.status.length +
    filters.priority.length +
    filters.assignee.length +
    filters.label.length;

  const sortKey = (searchParams.get("sort") ?? "priority") as SortKey;

  // internal id (as passed by the filter UI) → URL slug
  function toSlug(key: FilterKey, value: string | number): string {
    switch (key) {
      case "status":
        return statusIdToSlug(String(value));
      case "priority":
        return priorityIdToSlug(priorities, value as number);
      case "assignee":
        return assigneeIdToSlug(members, String(value));
      case "label":
        return labelIdToSlug(labels, String(value));
      default:
        return String(value);
    }
  }

  function pushParams(updater: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(searchParams.toString());
    updater(p);
    startTransition(() =>
      router.push(`${pathname}?${p.toString()}`, { scroll: false }),
    );
  }

  function toggleFilter(key: FilterKey, value: string | number) {
    pushParams((p) => {
      const cur = p.get(key)?.split(",").filter(Boolean) ?? [];
      const slug = toSlug(key, value);
      const next = cur.includes(slug)
        ? cur.filter((v) => v !== slug)
        : [...cur, slug];
      if (next.length) p.set(key, next.join(","));
      else p.delete(key);
    });
  }

  function clearFilter(key: FilterKey) {
    pushParams((p) => p.delete(key));
  }

  function clearAll() {
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  function setSort(key: SortKey) {
    pushParams((p) => p.set("sort", key));
  }

  // The view lives in the path, not the query — carry the filters across.
  function setView(next: View) {
    const qs = searchParams.toString();
    const suffix = qs ? `?${qs}` : "";
    startTransition(() =>
      router.push(
        next === "list"
          ? `${base}/project/${slug}/list${suffix}`
          : `${base}/project/${slug}${suffix}`,
      ),
    );
  }

  return {
    isPending,
    showFilters,
    showSort,
    project,
    filters,
    filterCount,
    sortKey,
    view,
    toggleFilter,
    clearFilter,
    clearAll,
    setSort,
    setView,
  };
}
