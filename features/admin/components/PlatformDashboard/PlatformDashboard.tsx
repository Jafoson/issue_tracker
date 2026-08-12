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
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { setAdminNoticeHidden } from "@/features/account/actions";
import type { DashboardData, PlatformStats } from "@/features/admin/queries";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { RANGES, type RangeKey, trend } from "@/lib/buckets";
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
 * Das Plattform-Dashboard.
 *
 * ── Der Aufbau ──
 *
 * Oben eine Reihe Bedienelemente, darunter alles, was sie betreffen — der
 * Zeitraum gilt für jede Zahl und jedes Diagramm auf dieser Seite, nicht je
 * Karte. Ein Dashboard, in dem zwei Karten verschiedene Wochen zeigen, ist keine
 * Übersicht, sondern eine Fehlerquelle.
 *
 * Der Zeitraum steht in der Adresse (`?range=30d`) statt im Zustand dieser
 * Komponente. Damit ist er teilbar, überlebt das Neuladen, und die Zahlen kommen
 * frisch vom Server — eine Auswertung im Browser hieße, alle Zeitstempel dorthin
 * zu übertragen.
 *
 * Darunter drei Ebenen, von grob nach fein: die Kennzahlen des Zeitraums mit
 * ihrer Veränderung, dann der Verlauf, dann wo die Last liegt. Ganz am Ende, was
 * Aufmerksamkeit braucht — das steht zuletzt, weil es meistens leer ist.
 *
 * ── Was hier nicht steht ──
 *
 * Kein Titel einer Aufgabe, kein Kommentar, kein Projektinhalt. Das Dashboard
 * zählt und zeigt Verläufe; *woran* gearbeitet wurde, steht nicht darin und wird
 * dafür auch nicht geladen (`features/admin/queries.ts`).
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
    // `replace` und nicht `push`: einen Zeitraum zu wechseln ist keine neue
    // Station, durch die man sich zurückklicken will.
    startTransition(() => {
      router.replace(`${pathname}?range=${range}`);
    });
  };

  // ── Die Achse beschriften ──
  //
  // Tage tragen Tag und Monat, Monate den Monatsnamen. Der Tooltip zeigt das
  // volle Datum; an der Achse wäre es eine Wand aus Ziffern.
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
    // Eine Woche ist ein Zeitraum, kein Tag — die Beschriftung sagt das.
    return data.unit === "week" ? t("dashboard.weekOf", { date: day }) : day;
  };

  // Beide Diagramme lesen dieselben Punkte und greifen sich über den Reihen-Key
  // heraus, was sie brauchen — `date` bleibt liegen und stört nicht.
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

  // Emphasis statt zweier gleichwertiger Farben: die gescheiterten Versuche sind
  // der Punkt dieses Diagramms, die gelungenen sind der Rahmen, vor dem man sie
  // liest. Deshalb trägt nur eine Reihe Farbe — die Warnfarbe, weil sie etwas
  // bedeutet — und die andere das Grau der Zurücknahme. Zwei bunte Reihen
  // stellten beide gleich laut nebeneinander und begrüben genau die eine, auf
  // die es ankommt.
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

  // Erst die Arbeit, dann die Hülle, in der sie stattfindet — und die Hülle von
  // außen nach innen: Workspace, Projekt, Konto. Dieselbe Reihenfolge wie die
  // Legende des Wachstums-Diagramms weiter unten, damit dieselben drei Dinge
  // nicht zweimal anders sortiert dastehen.
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
        {/* Eine Reihe, über allem, was sie betrifft. */}
        <div className={styles.controls}>
          {/* Ein `fieldset`, weil es genau das ist: mehrere Knöpfe, die zusammen
              einen Wert setzen. Die Beschriftung kommt per `aria-label` statt
              als sichtbare Legende — die Knöpfe sagen selbst, worum es geht. */}
          <fieldset className={styles.ranges} aria-label={t("dashboard.range")}>
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                className={styles.range}
                data-active={data.range === range || undefined}
                aria-pressed={data.range === range}
                onClick={() => pickRange(range)}
              >
                {t(`dashboard.range_${range}`)}
              </button>
            ))}
          </fieldset>

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

        {/* Während neue Zahlen geladen werden, bleibt das alte Bild stehen und
            tritt zurück. Ein Skelett an dieser Stelle wäre ein Sprung im
            Layout und ein Blitzen bei jedem Klick. */}
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
