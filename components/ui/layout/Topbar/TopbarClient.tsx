"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SegmentedControl } from "@/components/ui/atoms/SegmentedControl/SegmentedControl";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { TabBar } from "@/components/ui/layout/TabBar/TabBar";
import type { Translator } from "@/i18n/types";
import { useWorkspace } from "@/lib/workspace-context";
import { TopbarFilters } from "./components/TopbarFilters";
import styles from "./topbar.module.scss";
import { type SortKey, useTopbar } from "./useTopbar";

function sortOptions(t: Translator) {
  return [
    { value: "priority" as SortKey, label: t("sort.priority") },
    { value: "status" as SortKey, label: t("sort.status") },
    { value: "updated" as SortKey, label: t("sort.updated") },
    { value: "created" as SortKey, label: t("sort.created") },
    { value: "title" as SortKey, label: t("sort.title") },
    { value: "assignee" as SortKey, label: t("sort.assignee") },
  ];
}

export function TopbarClient() {
  const { projects, workspace } = useWorkspace();
  const t = useTranslations();
  const base = `/${workspace.id}`;

  const {
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
  } = useTopbar();

  const currentSlug =
    pathname.match(new RegExp(`^${base}/project/([^/]+)`))?.[1] ??
    projects[0]?.slug ??
    "";

  const currentProject =
    projects.find((p) => p.slug === currentSlug) ?? projects[0] ?? null;

  const SORT_OPTIONS = sortOptions(t);

  return (
    <header className={`${styles.header}${isPending ? " loading" : ""}`}>
      <div className={styles.topRow}>
        <TabBar />
      </div>

      {showFilters && (
        <TopbarFilters
          f={f}
          filterCount={filterCount}
          onToggle={toggleFilter}
          onClear={clearFilter}
          onClearAll={clearAll}
          t={t}
          projectId={currentProject?.id ?? ""}
          projectName={currentProject?.name ?? ""}
          end={
            <>
              {showSort && (
                <InlinePicker
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Icon icon="lucide:arrow-down" width={14} />}
                    >
                      {SORT_OPTIONS.find((o) => o.value === sortKey)?.label ??
                        t("sort.label")}
                    </Button>
                  }
                  width={180}
                >
                  {(close) => (
                    <SelectMenu
                      items={SORT_OPTIONS.map((o) => ({
                        value: o.value,
                        label: o.label,
                      }))}
                      value={sortKey}
                      onPick={(v) => {
                        pushParams((p) => p.set("sort", v as string));
                        close();
                      }}
                      onClose={close}
                    />
                  )}
                </InlinePicker>
              )}
              <SegmentedControl
                variant="surface"
                value={pathname.endsWith("/list") ? "list" : "board"}
                onChange={(v) => {
                  const qs = searchParams.toString();
                  const suffix = qs ? `?${qs}` : "";
                  router.push(
                    v === "list"
                      ? `${base}/project/${currentSlug}/list${suffix}`
                      : `${base}/project/${currentSlug}${suffix}`,
                  );
                }}
                items={[
                  {
                    value: "board",
                    icon: <Icon icon="lucide:layout-dashboard" width={16} />,
                  },
                  {
                    value: "list",
                    icon: <Icon icon="lucide:list" width={16} />,
                  },
                ]}
              />
            </>
          }
        />
      )}
    </header>
  );
}
