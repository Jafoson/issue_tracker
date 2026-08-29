"use client";

import { Icon } from "@iconify/react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Chip } from "@/components/ui/atoms/Chip/Chip";
import { BarList } from "@/components/ui/charts/BarList/BarList";
import { ChartCard } from "@/components/ui/charts/ChartCard/ChartCard";
import {
  type ChartPoint,
  type ChartSeries,
  ColumnChart,
} from "@/components/ui/charts/ColumnChart/ColumnChart";
import { RangePicker } from "@/components/ui/charts/RangePicker/RangePicker";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { setAdminNoticeHidden } from "@/features/account/actions";
import type { DashboardData, PlatformStats } from "@/features/admin/queries";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { type RangeKey, trend } from "@/lib/buckets";
import styles from "./platformDashboard.module.scss";

interface Props {
  stats: PlatformStats;
  data: DashboardData;
  links: {
    users?: string;
    workspaces?: string;
    projects?: string;
    audit?: string;
  };
  noticeHidden: boolean;
}

/**
 * The platform dashboard.
 *
 * ── The structure ──
 *
 * A row of controls at the top, below it everything they affect — the period
 * applies to every number and every chart on this page, not per card. A
 * dashboard where two cards show different weeks isn't an overview, it's a
 * source of errors.
 *
 * The period lives in the address (`?range=30d`) instead of this component's
 * state. That makes it shareable, survives a reload, and the numbers come
 * fresh from the server — evaluating in the browser would mean transferring
 * every timestamp there.
 *
 * Below that, three tiers, from coarse to fine: the period's key figures with
 * their change, then the trend over time, then where the load lies. At the
 * very end, what needs attention — that comes last because it's usually empty.
 *
 * ── What's deliberately not here ──
 *
 * No issue title, no comment, no project content. The dashboard counts and
 * shows trends; *what* was worked on doesn't appear in it and isn't loaded
 * for it either (`features/admin/queries.ts`).
 */
export function PlatformDashboard({ stats, data, links, noticeHidden }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const pathname = usePathname();

  const [isPending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(noticeHidden);
  const [asTable, setAsTable] = useState(false);

  const toggleNotice = (next: boolean) => {
    setHidden(next);
    startTransition(() => {
      setAdminNoticeHidden(next);
    });
  };

  const pickRange = (range: RangeKey) => {
    // `replace` and not `push`: switching a period isn't a new stop you'd
    // want to click back through.
    startTransition(() => {
      router.replace(`${pathname}?range=${range}`);
    });
  };

  // ── Labeling the axis ──
  //
  // Days carry day and month, months carry the month name. The tooltip shows
  // the full date; on the axis it would be a wall of digits.
  const axisLabel = (iso: string) => {
    const date = new Date(`${iso}T00:00:00`);
    if (data.unit === "month") return format.dateTime(date, { month: "short" });
    return format.dateTime(date, { day: "numeric", month: "numeric" });
  };

  const fullLabel = (iso: string) => {
    const date = new Date(`${iso}T00:00:00`);
    if (data.unit === "month")
      return format.dateTime(date, { month: "long", year: "numeric" });
    const day = format.dateTime(date, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    // A week is a period, not a day — the label says so.
    return data.unit === "week" ? t("dashboard.weekOf", { date: day }) : day;
  };

  // Both charts read the same points and pick out what they need via the
  // series key — `date` is left over and doesn't get in the way.
  const points: ChartPoint[] = data.points.map(({ date, ...values }) => ({
    key: date,
    label: fullLabel(date),
    short: axisLabel(date),
    values,
  }));

  const workSeries: ChartSeries[] = [
    { key: "issues", label: t("dashboard.issues"), color: "var(--chart-1)" },
    {
      key: "comments",
      label: t("dashboard.comments"),
      color: "var(--chart-2)",
    },
  ];

  // Emphasis instead of two equally weighted colors: the failed attempts are
  // the point of this chart, the successful ones are the backdrop against
  // which you read them. That's why only one series carries color — the
  // warning color, because it means something — and the other the gray of
  // recession. Two colorful series would place both equally loud side by
  // side and bury the one that actually matters.
  const loginSeries: ChartSeries[] = [
    { key: "logins", label: t("dashboard.logins"), color: "var(--outline)" },
    {
      key: "failedLogins",
      label: t("dashboard.loginsFailed"),
      color: "var(--warning)",
    },
  ];

  const growthSeries: ChartSeries[] = [
    {
      key: "workspaces",
      label: t("platform.workspaces"),
      color: "var(--chart-1)",
    },
    { key: "projects", label: t("platform.projects"), color: "var(--chart-2)" },
    { key: "users", label: t("platform.users"), color: "var(--chart-3)" },
  ];

  // Work first, then the shell it happens in — and the shell from outside
  // in: workspace, project, account. Same order as the growth chart's legend
  // further down, so the same three things aren't sorted differently twice.
  const kpis = [
    {
      key: "issues",
      label: t("dashboard.issues"),
      icon: "lucide:circle-dot",
      created: data.totals.issues,
      before: data.previous.issues,
      total: data.allTime.issues,
    },
    {
      key: "comments",
      label: t("dashboard.comments"),
      icon: "lucide:message-square",
      created: data.totals.comments,
      before: data.previous.comments,
      total: data.allTime.comments,
    },
    {
      key: "workspaces",
      label: t("platform.workspaces"),
      icon: "lucide:building-2",
      created: data.totals.workspaces,
      before: data.previous.workspaces,
      total: data.allTime.workspaces,
      href: links.workspaces,
    },
    {
      key: "projects",
      label: t("platform.projects"),
      icon: "lucide:folders",
      created: data.totals.projects,
      before: data.previous.projects,
      total: data.allTime.projects,
      href: links.projects,
    },
    {
      key: "users",
      label: t("platform.users"),
      icon: "lucide:users",
      created: data.totals.users,
      before: data.previous.users,
      total: data.allTime.users,
      href: links.users,
    },
  ];

  const attention = [
    {
      key: "deactivated",
      icon: "lucide:user-x",
      label: t("platform.deactivatedUsers"),
      value: stats.deactivatedUsers,
      hint: t("platform.deactivatedUsersHint"),
      href: links.users,
      warn: false,
    },
    {
      key: "orphaned",
      icon: "lucide:folder-x",
      label: t("platform.orphanedProjects"),
      value: stats.orphanedProjects,
      hint: t("platform.orphanedProjectsHint"),
      href: links.projects,
      warn: stats.orphanedProjects > 0,
    },
    {
      key: "breakglass",
      icon: "lucide:siren",
      label: t("platform.breakGlassCount"),
      value: stats.recentBreakGlass,
      hint: t("platform.breakGlassCountHint"),
      href: links.audit,
      warn: stats.recentBreakGlass > 0,
    },
  ];

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.overview")}
        description={t("platform.overviewDesc")}
        actions={
          hidden && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon icon="lucide:info" width={15} />}
              title={t("platform.scopeShow")}
              aria-label={t("platform.scopeShow")}
              onClick={() => toggleNotice(false)}
            />
          )
        }
      />

      <div className={styles.body}>
        {/* A single row, above everything it affects. */}
        <div className={styles.controls}>
          <RangePicker
            value={data.range}
            onChange={pickRange}
            label={t("dashboard.range")}
            labelFor={(range) => t(`dashboard.range_${range}`)}
          />

          <Chip
            type="filter"
            icon={<Icon icon="lucide:table-2" width={14} />}
            selected={asTable}
            onClick={() => setAsTable((value) => !value)}
          >
            {t("dashboard.asTable")}
          </Chip>
        </div>

        {!hidden && (
          <section className={styles.notice}>
            <Icon
              icon="lucide:eye-off"
              width={16}
              className={styles.noticeIcon}
            />
            <div className={styles.noticeText}>
              <h2 className={styles.noticeTitle}>{t("platform.scopeTitle")}</h2>
              <p className={styles.noticeBody}>{t("platform.scopeDesc")}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className={styles.noticeClose}
              icon={<Icon icon="lucide:x" width={15} />}
              title={t("platform.scopeHide")}
              aria-label={t("platform.scopeHide")}
              onClick={() => toggleNotice(true)}
            />
          </section>
        )}

        {/* While new numbers are loading, the old view stays in place and
            recedes. A skeleton here would be a layout jump and a flash on
            every click. */}
        <div className={styles.content} data-loading={isPending || undefined}>
          <div className={styles.kpis}>
            {kpis.map((kpi) => {
              const delta = trend(kpi.created, kpi.before);
              const tile = (
                <>
                  <span className={styles.kpiHead}>
                    <Icon
                      icon={kpi.icon}
                      width={15}
                      className={styles.kpiIcon}
                    />
                    {kpi.label}
                  </span>
                  <span className={styles.kpiValue}>
                    {format.number(kpi.created)}
                  </span>
                  <span className={styles.kpiFoot}>
                    {delta !== null && (
                      <span
                        className={styles.delta}
                        data-direction={
                          delta > 0 ? "up" : delta < 0 ? "down" : undefined
                        }
                      >
                        <Icon
                          icon={
                            delta > 0
                              ? "lucide:trending-up"
                              : delta < 0
                                ? "lucide:trending-down"
                                : "lucide:minus"
                          }
                          width={13}
                        />
                        {delta > 0 ? "+" : ""}
                        {delta}%
                      </span>
                    )}
                    <span className={styles.kpiTotal}>
                      {t("dashboard.ofTotal", {
                        total: format.number(kpi.total),
                      })}
                    </span>
                  </span>
                </>
              );

              return kpi.href ? (
                <Link key={kpi.key} href={kpi.href} className={styles.kpi}>
                  {tile}
                </Link>
              ) : (
                <div key={kpi.key} className={styles.kpi}>
                  {tile}
                </div>
              );
            })}
          </div>

          <div className={styles.charts}>
            <ChartCard
              title={t("dashboard.workTitle")}
              hint={t("dashboard.workHint")}
              series={workSeries}
              total={format.number(data.totals.issues + data.totals.comments)}
            >
              <ColumnChart
                series={workSeries}
                points={points}
                label={t("dashboard.workTitle")}
                valueLabel={t("dashboard.period")}
                asTable={asTable}
              />
            </ChartCard>

            <div className={styles.chartRow}>
              <ChartCard
                title={t("dashboard.growthTitle")}
                hint={t("dashboard.growthHint")}
                series={growthSeries}
                total={format.number(
                  data.totals.workspaces +
                    data.totals.projects +
                    data.totals.users,
                )}
              >
                <ColumnChart
                  series={growthSeries}
                  points={points}
                  label={t("dashboard.growthTitle")}
                  valueLabel={t("dashboard.period")}
                  asTable={asTable}
                />
              </ChartCard>

              <ChartCard
                title={t("dashboard.loginsTitle")}
                hint={t("dashboard.loginsHint")}
                series={loginSeries}
                total={format.number(
                  data.points.reduce((sum, point) => sum + point.logins, 0),
                )}
              >
                <ColumnChart
                  series={loginSeries}
                  points={points}
                  label={t("dashboard.loginsTitle")}
                  valueLabel={t("dashboard.period")}
                  asTable={asTable}
                />
              </ChartCard>

              <ChartCard
                title={t("dashboard.largestTitle")}
                hint={t("dashboard.largestHint")}
              >
                <BarList
                  rows={data.topWorkspaces.map((workspace) => ({
                    id: workspace.id,
                    label: workspace.name,
                    value: workspace.issues,
                    dot: workspace.color,
                    meta: t("dashboard.workspaceMeta", {
                      projects: workspace.projects,
                      members: workspace.members,
                    }),
                  }))}
                  label={t("dashboard.largestTitle")}
                  valueLabel={t("dashboard.issues")}
                  asTable={asTable}
                />
              </ChartCard>
            </div>
          </div>

          <section className={styles.group}>
            <h2 className={styles.groupTitle}>{t("platform.attention")}</h2>
            <div className={styles.attention}>
              {attention.map((card) => {
                const inner = (
                  <>
                    <span className={styles.cardIcon}>
                      <Icon icon={card.icon} width={16} />
                    </span>
                    <span className={styles.cardValue}>{card.value}</span>
                    <span className={styles.cardLabel}>{card.label}</span>
                    <span className={styles.cardHint}>{card.hint}</span>
                  </>
                );

                return card.href ? (
                  <Link
                    key={card.key}
                    href={card.href}
                    className={styles.card}
                    data-warn={card.warn ? "" : undefined}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    key={card.key}
                    className={styles.card}
                    data-warn={card.warn ? "" : undefined}
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
