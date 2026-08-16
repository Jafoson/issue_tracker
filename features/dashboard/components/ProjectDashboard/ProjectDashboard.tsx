"use client";

import { Icon } from "@iconify/react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Chip } from "@/components/ui/atoms/Chip/Chip";
import { SegmentedControl } from "@/components/ui/atoms/SegmentedControl/SegmentedControl";
import { BarList, type BarRow } from "@/components/ui/charts/BarList/BarList";
import { ChartCard } from "@/components/ui/charts/ChartCard/ChartCard";
import {
  type ChartPoint,
  type ChartSeries,
  ColumnChart,
} from "@/components/ui/charts/ColumnChart/ColumnChart";
import { RangePicker } from "@/components/ui/charts/RangePicker/RangePicker";
import { ScopePicker } from "@/components/ui/charts/ScopePicker/ScopePicker";
import { StackedBar } from "@/components/ui/charts/StackedBar/StackedBar";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import type { ActivityView } from "@/features/audit/queries";
import {
  resetDashboardLayout,
  saveDashboardLayout,
  setDashboardRange,
  setDashboardScope,
  setDashboardView,
} from "@/features/dashboard/actions";
import { CustomizeDialog } from "@/features/dashboard/components/CustomizeDialog/CustomizeDialog";
import {
  IssueList,
  ReasonBadge,
} from "@/features/dashboard/components/IssueList/IssueList";
import type { DashboardScope } from "@/features/dashboard/scope";
import type { ProjectDashboardView } from "@/features/dashboard/types";
import {
  DEFAULT_PROJECT_VIEW,
  type ProjectView,
} from "@/features/dashboard/view";
import type { WidgetKey } from "@/features/dashboard/widgets";
import { widgetDef } from "@/features/dashboard/widgets";
import { PriorityIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { RangeKey } from "@/lib/buckets";
import { useModal } from "@/lib/context";
import { fullName } from "@/lib/utils/string";
import { ProjectProfileView } from "./components/ProjectProfileView";
import styles from "./projectDashboard.module.scss";

interface Props extends ProjectDashboardView {
  /** Welche Ansicht aufgeht — aus `?view=` in der Adresse. */
  view: ProjectView;
  /** Basisadresse für Aufgaben: `/<workspace>/issue`. */
  issueBase: string;
  /** Für den Label-Dialog in der Übersicht — `LabelModal` braucht ihn direkt. */
  workspaceId: string;
  /** Adressen der Nachbarbereiche dieses Projekts. */
  links: {
    board: string;
    list: string;
    members: string;
    settings: string;
    /** Die Teamverwaltung liegt eine Ebene höher — Teams gehören dem Workspace. */
    teams: string;
    /** Die volle, filterbare Liste — die Aktivitäts-Karte der Übersicht zeigt nur einen Ausschnitt. */
    activity: string;
  };
  /** Für die Aktivitäts-Karte der Übersicht — bereits auf `audit.view` gefiltert (`getProjectActivity`). */
  activity: ActivityView;
}

/** Die Zeichen der drei Gründe in „Braucht Aufmerksamkeit". */
const REASON_ICONS = {
  unassigned: "lucide:user-x",
  urgent: "lucide:triangle-alert",
  stale: "lucide:clock-alert",
} as const;

/**
 * Die Startseite eines Projekts — in zwei Ansichten.
 *
 * ── Übersicht oder Dashboard ──
 *
 * Beide beantworten eine andere Frage. Die **Übersicht** sagt, was das Projekt
 * ist: Zweck, Kürzel, Leitung, wer Zugriff hat. Das gilt auch nächsten Monat
 * noch und kennt deshalb gar keinen Zeitraum — sie ist die Vorgabe. Das
 * **Dashboard** sagt, wie es gerade läuft: Zahlen, Verläufe, was liegen bleibt.
 * Alles davon ändert sich stündlich und hängt am gewählten Zeitraum.
 *
 * Welche von beiden aufgeht, merkt sich die Seite (`DashboardPreference.view`):
 * die Projektzeile in der Seitenleiste führt ohne `?view=` hierher, und wer
 * zuletzt die Zahlen ansah, will sie beim nächsten Klick nicht erst wieder
 * aufrufen.
 *
 * Sie stehen als Umschalter nebeneinander und nicht als zwei Routen, obwohl die
 * Einstellungen es andersherum machen: dort *ersetzt* der Wechsel den ganzen
 * Bereich samt Navigation, hier bleibt alles stehen und nur die Karten tauschen.
 * Die Daten für beide kommen ohnehin aus einem Aufruf (`getProjectDashboard`),
 * der Wechsel kostet also keinen Serverlauf — und `?view=` in der Adresse macht
 * ihn trotzdem teilbar und übersteht das Neuladen.
 *
 * ── Der Aufbau ──
 *
 * Oben eine Reihe Bedienelemente, darunter alles, was sie betreffen — der
 * Zeitraum gilt für jede Zahl auf dieser Seite, nicht je Karte. Ein Dashboard, in
 * dem zwei Karten verschiedene Wochen zeigen, ist keine Übersicht, sondern eine
 * Fehlerquelle. In der Übersicht steht die Reihe gar nicht erst da: Zeitraum,
 * Tabellenansicht und „Anpassen" haben dort nichts zu tun, und ein Bedienelement
 * ohne Wirkung ist schlimmer als keines.
 *
 * Der Zeitraum steht in der Adresse (`?range=30d`) statt im Zustand dieser
 * Komponente: damit ist er teilbar, überlebt das Neuladen, und die Zahlen kommen
 * frisch vom Server. Zusätzlich wird er im Konto vermerkt — die Adresse trägt
 * den Zeitraum *dieses* Aufrufs, die Vorliebe den, mit dem das Dashboard das
 * nächste Mal aufgeht.
 *
 * ── Die Anordnung ──
 *
 * Welche Bausteine in welcher Reihenfolge stehen, entscheidet jede Person für
 * sich (`features/dashboard/widgets.ts`). Diese Komponente kennt die
 * Entscheidung nicht, sie liest sie: `order` kommt fertig vom Server, und die
 * Schleife unten zeichnet, was darin steht. Ein `if` je Baustein hätte dieselbe
 * Reihenfolge ein zweites Mal festgeschrieben — und zwar die, die im Quelltext
 * steht, nicht die, die jemand eingestellt hat.
 */
export function ProjectDashboard({
  project,
  data,
  profile,
  order,
  hidden,
  view,
  issueBase,
  workspaceId,
  links,
  activity,
}: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const { openModal } = useModal();

  const [isPending, startTransition] = useTransition();
  const [asTable, setAsTable] = useState(false);

  /**
   * Die Übersicht ist die Vorgabe und kennt gar keinen Zeitraum — sie bekommt
   * die blanke Adresse, ohne `?view=` und ohne `?range=`. Alles andere trägt
   * beide Werte, auch den, der gerade nicht wechselt: sonst verlöre ein
   * Wechsel der Ansicht den eingestellten Zeitraum, und wer vom Dashboard
   * zurück zur Übersicht und wieder zum Dashboard geht, stünde erneut auf der
   * Vorgabe.
   */
  const urlWith = (patch: {
    view?: ProjectView;
    range?: RangeKey;
    scope?: DashboardScope;
  }) => {
    const nextView = patch.view ?? view;
    if (nextView === DEFAULT_PROJECT_VIEW) return pathname;

    const next = new URLSearchParams({
      view: nextView,
      range: patch.range ?? data.range,
      scope: patch.scope ?? data.scope,
    });
    return `${pathname}?${next}`;
  };

  const pickRange = (range: RangeKey) => {
    startTransition(async () => {
      // `replace` und nicht `push`: einen Zeitraum zu wechseln ist keine neue
      // Station, durch die man sich zurückklicken will.
      router.replace(urlWith({ range }));
      // Und nebenbei merken, womit dieses Dashboard künftig aufgehen soll. Wer
      // einmal auf „12 Monate" stellt, meint selten nur diesen einen Aufruf.
      await setDashboardRange(project.id, range);
    });
  };

  const pickScope = (scope: DashboardScope) => {
    startTransition(async () => {
      router.replace(urlWith({ scope }));
      await setDashboardScope(project.id, scope);
    });
  };

  const pickView = (next: string) => {
    startTransition(async () => {
      // `replace`: das sind zwei Blicke auf dasselbe Projekt, keine zwei
      // Stationen. Die Daten liegen schon im Client — der Wechsel ist sofort
      // da, die Adresse zieht nur nach.
      router.replace(urlWith({ view: next as ProjectView }));
      // Und merken, wo man war: die Projektzeile in der Seitenleiste führt ohne
      // `?view=` hierher zurück und soll dann dieselbe Ansicht öffnen.
      await setDashboardView(project.id, next);
    });
  };

  const customize = () =>
    openModal(
      ({ close }) => (
        <CustomizeDialog
          order={order}
          hidden={hidden}
          close={close}
          onSave={(o, h) => saveDashboardLayout(project.id, o, h)}
          onReset={() => resetDashboardLayout(project.id)}
        />
      ),
      { label: t("dashboard.customize") },
    );

  const issueHref = (ref: string) => `${issueBase}/${ref.toLowerCase()}`;

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

  const points: ChartPoint[] = data.throughput.map(({ date, ...values }) => ({
    key: date,
    label: fullLabel(date),
    short: axisLabel(date),
    values,
  }));

  // Angelegt zuerst, geschlossen darüber: gelesen wird „wie viel kommt herein,
  // wie viel geht hinaus", und in dieser Reihenfolge steht es auch im Tooltip.
  const flowSeries: ChartSeries[] = [
    {
      key: "created",
      label: t("dashboard.opened"),
      color: "var(--chart-1)",
    },
    {
      key: "closed",
      label: t("dashboard.closed"),
      color: "var(--chart-3)",
    },
  ];

  // ── Die Kennzahlen ──
  //
  // Bestand zuerst, Bewegung danach, und am Ende die Zeit, die beides verbindet.
  // Jede trägt eine zweite Zeile, die sagt, worauf sich die Zahl bezieht — eine
  // Zahl ohne Bezugsgröße ist keine Auskunft.
  const stats = [
    {
      key: "open",
      label: t("dashboard.statOpen"),
      value: format.number(data.stats.open),
      foot: t("dashboard.statOpenFoot", {
        percent:
          data.stats.total === 0
            ? 0
            : Math.round((data.stats.open / data.stats.total) * 100),
        total: data.stats.total,
      }),
      href: links.list,
    },
    {
      key: "progress",
      label: t("dashboard.statProgress"),
      value: format.number(data.stats.inProgress),
      foot: t("dashboard.statProgressFoot", { count: data.stats.inReview }),
      href: links.list,
    },
    {
      key: "closed",
      label: t("dashboard.statClosed"),
      value: format.number(data.stats.closed),
      // Der Saldo ist die eigentliche Auskunft: fünf geschlossene Aufgaben sind
      // ein Fortschritt, wenn drei dazukamen, und keiner, wenn es acht waren.
      foot: t("dashboard.statClosedFoot", {
        created: data.stats.created,
        net: `${data.stats.created - data.stats.closed >= 0 ? "+" : ""}${
          data.stats.created - data.stats.closed
        }`,
      }),
    },
    {
      key: "urgent",
      label: t("dashboard.statUrgent"),
      value: format.number(data.stats.urgent),
      foot:
        data.stats.urgentUnassigned > 0
          ? t("dashboard.statUrgentOpen", {
              count: data.stats.urgentUnassigned,
            })
          : t("dashboard.statUrgentAssigned"),
      // Rot nur, wenn es etwas zu sagen hat. Eine Kachel, die immer leuchtet,
      // leuchtet für nichts.
      warn: data.stats.urgent > 0,
    },
    {
      key: "cycle",
      label: t("dashboard.statCycle"),
      value:
        data.stats.cycleDays === null
          ? "—"
          : t("dashboard.days", {
              days: format.number(data.stats.cycleDays, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }),
            }),
      foot: t("dashboard.statCycleFoot"),
    },
  ];

  // Der Name kommt aus den Workspace-Stammdaten und nicht aus dem
  // Sprachkatalog — genauso, wie ihn Board und Liste nebenan zeigen. Ein
  // Dashboard, das „Dringend" schreibt, während die Spalte daneben „Urgent"
  // sagt, sähe aus wie zwei verschiedene Programme.
  const priorityRows: BarRow[] = data.priorities.map((priority) => ({
    id: String(priority.id),
    label: priority.name,
    value: priority.count,
    leading: <PriorityIcon priority={priority.id} size={14} />,
  }));

  const workloadRows: BarRow[] = data.workload.map((row) => ({
    id: row.user?.id ?? "unassigned",
    label: row.user ? fullName(row.user) : t("fields.unassigned"),
    value: row.open,
    meta:
      row.inProgress > 0
        ? t("dashboard.workloadMeta", { count: row.inProgress })
        : undefined,
    leading: (
      <Avatar
        avatar={row.user}
        size={22}
        placeholder={!row.user}
        placeholderLabel={t("fields.unassigned")}
      />
    ),
  }));

  // ── Ein Baustein je Schlüssel ──
  //
  // Ein Objekt und keine `switch`-Anweisung: so ist auf einen Blick zu sehen,
  // dass jeder Schlüssel aus der Registry hier eine Entsprechung hat, und ein
  // vergessener fällt beim Typecheck auf statt still nichts zu zeichnen.
  const widgets: Record<WidgetKey, ReactNode> = {
    stats: (
      <div className={styles.stats}>
        {stats.map((stat) => {
          const inner = (
            <>
              <span className={styles.statLabel}>{stat.label}</span>
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.statFoot}>{stat.foot}</span>
            </>
          );
          return stat.href ? (
            <Link key={stat.key} href={stat.href} className={styles.stat}>
              {inner}
            </Link>
          ) : (
            <div
              key={stat.key}
              className={styles.stat}
              data-warn={stat.warn ? "" : undefined}
            >
              {inner}
            </div>
          );
        })}
      </div>
    ),

    status: (
      <ChartCard
        title={t("dashboard.statusTitle")}
        hint={t("dashboard.statusHint")}
        total={format.number(data.stats.total)}
      >
        <StackedBar
          segments={data.statuses.map((status) => ({
            id: status.id,
            label: status.short,
            value: status.count,
            color: status.color,
          }))}
          label={t("dashboard.statusTitle")}
          valueLabel={t("dashboard.issues")}
          asTable={asTable}
        />
      </ChartCard>
    ),

    throughput: (
      <ChartCard
        title={t("dashboard.flowTitle")}
        hint={t("dashboard.flowHint")}
        series={flowSeries}
        total={format.number(data.stats.closed)}
      >
        <ColumnChart
          series={flowSeries}
          points={points}
          label={t("dashboard.flowTitle")}
          valueLabel={t("dashboard.period")}
          asTable={asTable}
        />
      </ChartCard>
    ),

    priority: (
      <ChartCard
        title={t("dashboard.priorityTitle")}
        hint={t("dashboard.priorityHint")}
        total={format.number(data.stats.open)}
      >
        <BarList
          rows={priorityRows}
          label={t("dashboard.priorityTitle")}
          valueLabel={t("dashboard.issues")}
          asTable={asTable}
        />
      </ChartCard>
    ),

    workload: (
      <ChartCard
        title={t("dashboard.workloadTitle")}
        hint={t("dashboard.workloadHint")}
        total={format.number(data.stats.open)}
      >
        {workloadRows.length === 0 ? (
          <p className={styles.none}>{t("dashboard.workloadEmpty")}</p>
        ) : (
          <BarList
            rows={workloadRows}
            label={t("dashboard.workloadTitle")}
            valueLabel={t("dashboard.issues")}
            asTable={asTable}
          />
        )}
      </ChartCard>
    ),

    attention: (
      <ChartCard
        title={t("dashboard.attentionTitle")}
        hint={t("dashboard.attentionHint")}
        total={format.number(data.attention.length)}
      >
        <IssueList
          issues={data.attention}
          hrefFor={issueHref}
          badgeFor={(issue) => (
            <ReasonBadge
              icon={REASON_ICONS[issue.reason]}
              label={t(`dashboard.reason_${issue.reason}`)}
            />
          )}
          emptyIcon={<Icon icon="lucide:check-check" width={26} />}
          emptyTitle={t("dashboard.attentionEmpty")}
          emptyDescription={t("dashboard.attentionEmptyHint")}
        />
      </ChartCard>
    ),
  };

  const isDashboard = view === "dashboard";

  // Auslastung ist eine Frage der Verteilung über mehrere Personen — bezogen
  // auf nur die eigene Person hat sie keine Antwort mehr. Nur die Zeichnung
  // blendet ihn aus, die gespeicherte Anordnung bleibt unberührt: schaltet
  // jemand zurück auf „Alle", steht der Baustein wieder da, wo er stand.
  const visibleOrder =
    data.scope === "mine" ? order.filter((key) => key !== "workload") : order;

  return (
    <>
      <PageHeader
        divider={false}
        leading={
          <span
            className={styles.dot}
            style={{ background: project.color }}
            aria-hidden="true"
          />
        }
        title={project.name}
        // Ohne Beschreibungssatz — in beiden Ansichten. Was die Seite zeigt,
        // sagt der Umschalter daneben schon, und in der Übersicht sagt es die
        // Kopfkarte darunter noch genauer. Wichtig ist nur, dass *beide*
        // Ansichten es gleich halten: eine Kopfzeile, die in der einen zwei und
        // in der anderen eine Zeile hoch ist, springt beim Umschalten und reißt
        // alles darunter mit. Das Polster stellt `PageHeader` selbst um
        // (`:has(.description)`).
        // Der Umschalter steht ganz oben, auf einer Höhe mit dem Projektnamen:
        // er wechselt die ganze Seite und gehört damit über alles, was er
        // wechselt — nicht in die Reihe der Bedienelemente darunter, die nur
        // für eine der beiden Ansichten gilt.
        actions={
          <SegmentedControl
            variant="surface"
            value={view}
            onChange={pickView}
            items={[
              {
                value: "profile",
                label: t("dashboard.viewProfile"),
                icon: <Icon icon="lucide:info" width={15} />,
              },
              {
                value: "dashboard",
                label: t("dashboard.viewDashboard"),
                icon: <Icon icon="lucide:layout-dashboard" width={15} />,
              },
            ]}
          />
        }
      />

      <div className={styles.body} data-view={view}>
        {/* Eine Reihe, über allem, was sie betrifft — und nur dort, wo sie
            etwas bewirkt. Die Übersicht kennt keinen Zeitraum, keine
            Tabellenansicht und nichts zum Anpassen. */}
        {isDashboard && (
          <div className={styles.controls}>
            <RangePicker
              value={data.range}
              onChange={pickRange}
              label={t("dashboard.range")}
              labelFor={(range) => t(`dashboard.range_${range}`)}
            />

            {/* Nur, wer `dashboard.view.all` trägt, darf zwischen den eigenen
                und den Zahlen des ganzen Projekts wählen — für alle anderen
                ist `data.scope` ohnehin fest auf "mine" (`getProjectDashboard`). */}
            {profile.canViewAllStats && (
              <ScopePicker
                value={data.scope}
                onChange={pickScope}
                label={t("dashboard.scope")}
                labelFor={(scope) => t(`dashboard.scope_${scope}`)}
              />
            )}

            <div className={styles.tools}>
              <Chip
                type="filter"
                icon={<Icon icon="lucide:table-2" width={14} />}
                selected={asTable}
                onClick={() => setAsTable((value) => !value)}
              >
                {t("dashboard.asTable")}
              </Chip>

              <Button
                variant="elevated"
                icon={<Icon icon="lucide:sliders-horizontal" width={15} />}
                onClick={customize}
              >
                {t("dashboard.customize")}
              </Button>
            </div>
          </div>
        )}

        {isDashboard && data.scope === "mine" && (
          <p className={styles.scopeHint}>
            <Icon icon="lucide:user" width={14} />
            {t("dashboard.scopeMineHint")}
          </p>
        )}

        {/* Während neue Zahlen geladen werden, bleibt das alte Bild stehen und
            tritt zurück. Ein Skelett an dieser Stelle wäre ein Sprung im
            Layout und ein Blitzen bei jedem Klick. */}
        {isDashboard ? (
          <div className={styles.grid} data-loading={isPending || undefined}>
            {visibleOrder.map((key) => (
              <div
                key={key}
                className={styles.cell}
                data-span={widgetDef(key).span}
              >
                {widgets[key]}
              </div>
            ))}
          </div>
        ) : (
          <ProjectProfileView
            project={project}
            workspaceId={workspaceId}
            profile={profile}
            stats={data.stats}
            links={links}
            activity={activity}
          />
        )}
      </div>
    </>
  );
}
