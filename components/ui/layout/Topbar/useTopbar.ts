"use client";

import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useTransition } from "react";
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

export function useTopbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { locale } = useParams<{ locale: string }>();
  const { priorities, members, labels, workspace } = useWorkspace();
  const base = `/${locale}/${workspace.id}`;

  const showFilters = pathname.startsWith(`${base}/project/`);
  const showSort =
    pathname.startsWith(`${base}/project/`) && pathname.endsWith("/list");

  // URL holds slugs; the UI works in internal-id space — translate on read.
  const parse = (key: string) =>
    searchParams.get(key)?.split(",").filter(Boolean) ?? [];

  const f = {
    statuses: parse("status").map(statusSlugToId),
    priorities: parse("priority")
      .map((s) => prioritySlugToId(priorities, s))
      .filter((n): n is number => n !== undefined),
    assignees: parse("assignee")
      .map((s) => assigneeSlugToId(members, s))
      .filter((id): id is string => Boolean(id)),
    labels: parse("label")
      .map((s) => labelSlugToId(labels, s))
      .filter((id): id is string => Boolean(id)),
  };

  // internal id (as passed by the filter UI) → URL slug
  function toSlug(key: string, value: string | number): string {
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
  const filterCount =
    f.statuses.length +
    f.priorities.length +
    f.assignees.length +
    f.labels.length;
  const sortKey = (searchParams.get("sort") ?? "priority") as SortKey;

  function pushParams(updater: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(searchParams.toString());
    updater(p);
    startTransition(() =>
      router.push(`${pathname}?${p.toString()}`, { scroll: false }),
    );
  }

  function toggleFilter(key: string, value: string | number) {
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

  function clearFilter(key: string) {
    pushParams((p) => p.delete(key));
  }

  function clearAll() {
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  return {
    router,
    pathname,
    searchParams,
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
