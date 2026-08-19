"use client";

import { Icon } from "@iconify/react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import buttonStyles from "@/components/ui/atoms/Button/button.module.scss";
import { Label } from "@/components/ui/atoms/Label/Label";
import { ActivityFeed } from "@/features/audit/components/ActivityFeed/ActivityFeed";
import type { ActivityView } from "@/features/audit/queries";
import type {
  DashboardStats,
  ProjectProfile,
} from "@/features/dashboard/types";
import { LabelModal } from "@/features/issues/components/LabelModal/LabelModal";
import { Link, useRouter } from "@/i18n/navigation";
import { useModal } from "@/lib/context";
import { roleColor } from "@/lib/rbac";
import { fullName } from "@/lib/utils/string";
import styles from "./projectProfileView.module.scss";

interface Props {
  /** Name, Farbe und Id stehen in der Kopfkarte bzw. brauchen den Label-Dialog. */
  project: {
    id: string;
    name: string;
    color: string;
    avatarUrl: string | null;
  };
  workspaceId: string;
  profile: ProjectProfile;
  stats: DashboardStats;
  /** Adressen der Nachbarbereiche — die Kachelreihe unten verlinkt sie. */
  links: {
    board: string;
    list: string;
    members: string;
    settings: string;
    /** Die Teamverwaltung liegt eine Ebene höher — Teams gehören dem Workspace. */
    teams: string;
    /** Die volle, filterbare Liste — die Karte unten zeigt nur einen Ausschnitt. */
    activity: string;
  };
  /** Ausschnitt des Aktivitäts-Protokolls — ohne `audit.view` schon auf die
   * eigenen Einträge gefiltert (`getProjectActivity`). */
  activity: ActivityView;
}

interface CardProps {
  title: string;
  /** Zahl neben der Überschrift, wo die Karte eine Liste zeigt. */
  count?: number;
  /**
   * Nichts drin. Die Karte wechselt dann von der gefüllten in die gestrichelte
   * Form — sie sagt „hier ist Platz" statt „hier fehlt etwas". Ein grauer Satz
   * in einem ansonsten normalen Kasten liest sich wie ein Ladefehler.
   */
  empty?: boolean;
  /** Gestrichelter Rahmen unabhängig vom Inhalt — für Listen-Cards, die immer
   * so aussehen sollen, nicht nur wenn sie leer sind (wie im Workspace-Steckbrief). */
  dashed?: boolean;
  /**
   * Für die Mitgliederkarte: der Inhalt scrollt in sich selbst, statt die
   * Karte (und mit ihr die ganze Seite) beliebig in die Länge zu ziehen — bei
   * vielen Mitgliedern bleiben Titel und „Alle Mitglieder" so erreichbar, ohne
   * dass man sich erst an ihnen vorbeischrollen muss.
   */
  scrollBody?: boolean;
  /**
   * Für die Aktivitäts-Karte: sie nimmt sich den Platz, der nach Kopfkarte,
   * Eckdaten und Teams/Labels in `.main` noch übrig ist, statt mit ihrem
   * Inhalt zu wachsen — genau die Rolle, die `align-items: stretch` in
   * `.side` für die Mitgliederkarte schon automatisch übernimmt. `.main` ist
   * aber eine Flex-Spalte ohne fremdbestimmte Höhe, deshalb hier ausdrücklich.
   * Ergibt nur zusammen mit `scrollBody` Sinn: sonst wüchse die Karte selbst
   * immer weiter mit ihrem Inhalt.
   */
  grow?: boolean;
  /** Knopf oben rechts neben Titel und Zahl, z. B. zum Anlegen oder Verwalten. */
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

function Card({
  title,
  count,
  empty,
  dashed,
  scrollBody,
  grow,
  action,
  footer,
  children,
}: CardProps) {
  const content = (
    <>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>
          {title}
          {count !== undefined && <span className={styles.count}>{count}</span>}
        </h3>
        {action}
      </div>
      <div className={styles.cardBody}>{children}</div>
      {footer}
    </>
  );

  return (
    <section
      className={styles.card}
      data-empty={empty || undefined}
      data-dashed={dashed || undefined}
      data-scroll={scrollBody || undefined}
      data-grow={grow || undefined}
    >
      {/* Scrollt als Ganzes (Kopf, Liste, Fuß) statt nur die Zeilen dazwischen
          — sonst deckt der Scrollbalken nicht die ganze Höhe der Karte ab.
          Kopf und Fuß bleiben trotzdem stehen: `position: sticky`, siehe
          `.card[data-scroll] .cardHead`/`.cardLink` im Stylesheet. */}
      {scrollBody ? (
        <div className={styles.cardScroll}>{content}</div>
      ) : (
        content
      )}
    </section>
  );
}

/**
 * Der Steckbrief des Projekts: was es ist, wem es gehört, woraus es besteht.
 *
 * Die Gegenansicht zum Dashboard, und bewusst eine andere Art von Auskunft.
 * Das Dashboard beantwortet „wie läuft es gerade" und ändert sich stündlich;
 * hier steht, was auch nächsten Monat noch gilt — Zweck, Kürzel, Leitung,
 * Zugriff. Deshalb trägt diese Ansicht auch keinen Zeitraum: ein Kürzel hat
 * keine 30 Tage.
 *
 * ── Vier Ebenen, vier Darstellungen ──
 *
 * Sechs gleich aussehende Kästen untereinander sind keine Übersicht, sondern
 * eine Liste, in der alles gleich wichtig aussieht. Die Seite staffelt deshalb:
 *
 *   1. Wer bin ich: die **Kopfkarte** mit dem Zeichen des Projekts, seinem Namen
 *      und seinem Zweck — größerer Radius, mehr Polster, der Einstieg.
 *   2. Die Eckdaten als **eine umrandete Leiste** mit Trennstrichen. Vier
 *      einzelne Kästen wären vier Dinge; es ist aber eine Zeile Stammdaten.
 *   3. Wer und Womit als **gefüllte Karten**, die sich die Breite teilen. Was
 *      leer ist, wird gestrichelt statt gefüllt.
 *   4. Die Wege hinaus als **umrandete Kacheln** ganz unten — sie führen weg von
 *      dieser Seite und gehören deshalb ans Ende, nicht dazwischen.
 *
 * Sie ist nicht anpassbar. Ein Steckbrief mit abschaltbaren Feldern wäre kein
 * Steckbrief mehr — man schlägt ihn gerade deshalb nach, weil immer dasselbe
 * darin steht.
 */
export function ProjectProfileView({
  project,
  workspaceId,
  profile,
  stats,
  links,
  activity,
}: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const { openModal } = useModal();

  const openNewLabel = () =>
    openModal(({ close }) => (
      <LabelModal
        workspaceId={workspaceId}
        projectId={project.id}
        onDone={() => router.refresh()}
        close={close}
      />
    ));

  const created = format.dateTime(new Date(profile.createdAt), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isPrivate = profile.visibility === "private";

  const facts = [
    {
      key: "prefix",
      icon: "lucide:hash",
      label: t("fields.prefix"),
      // Das Kürzel in der Schrift, in der es auch an den Aufgaben steht.
      value: <code className={styles.mono}>{profile.prefix}</code>,
    },
    {
      key: "visibility",
      icon: isPrivate ? "lucide:lock" : "lucide:globe",
      label: t("projectSettings.visibility"),
      value: t(
        isPrivate ? "projectSettings.private" : "projectSettings.public",
      ),
    },
    {
      key: "created",
      icon: "lucide:calendar",
      label: t("fields.created"),
      value: created,
      // Wer es angelegt hat, steht klein darunter statt im selben Satz: das
      // Datum ist die Auskunft, der Name die Fußnote dazu.
      meta: profile.createdBy ? fullName(profile.createdBy) : undefined,
    },
    {
      key: "issues",
      icon: "lucide:circle-dot",
      label: t("dashboard.issues"),
      value: t("dashboard.issuesOpen", { count: stats.open }),
      meta: t("dashboard.issuesTotal", { count: stats.total }),
    },
  ];

  // Zeichen und Beschriftung sind dieselben wie in der Seitenleiste
  // (`PROJECT_NAV`) — ein Bereich soll nicht davon abhängen, durch welche Tür
  // man ihn betritt. Die Adressen baut die Seite, weil nur sie den Workspace
  // kennt.
  //
  // Ohne canViewSettings bliebe die Kachel sonst die einzige Tür zu den
  // Einstellungen, obwohl derselbe Tab in der Seitenleiste (`PROJECT_NAV`)
  // längst ausgeblendet ist.
  const shortcuts = (
    [
      { key: "board", icon: "lucide:square-kanban", href: links.board },
      { key: "issues", icon: "lucide:list", href: links.list },
      { key: "members", icon: "lucide:users", href: links.members },
      { key: "settings", icon: "lucide:settings", href: links.settings },
    ] as const
  ).filter((s) => s.key !== "settings" || profile.canViewSettings);

  // Zwei Arten, eine Rolle zu zeigen — die Gruppen kommen fertig sortiert vom
  // Server, hier wird nur getrennt, wer einzeln genannt wird und wer in der
  // Liste steht.
  const named = profile.roles.filter((role) => role.distinguished);
  const rest = profile.roles.filter((role) => !role.distinguished);

  return (
    <div className={styles.page}>
      {/* Alles, was das Projekt selbst beschreibt, steht in einer Spalte —
          erst wer es ist, dann seine Eckdaten, dann womit gearbeitet wird. Die
          Mitglieder stehen daneben (`.side`) und lesen sich als eigene Spalte;
          im Dokument kommen sie danach, damit Auge und Vorleser dieselbe
          Reihenfolge bekommen. */}
      <div className={styles.main}>
        {/* ── 1. Wer bin ich ── */}
        <header className={styles.hero}>
          {/* Dasselbe Zeichen, mit dem die App das Projekt überall meint — nur
            groß. `Avatar` bringt Form, Rundung und die Schriftfarbe mit, die
            zur Projektfarbe passt; nachgebaut wäre das eine zweite Rechnung,
            die bei einer hellen Farbe still falsch würde. */}
          <Avatar
            avatar={{
              name: project.name,
              color: project.color,
              image: project.avatarUrl ?? undefined,
            }}
            shape="square"
            size={92}
          />

          <div className={styles.heroText}>
            <h2 className={styles.heroName}>{project.name}</h2>
            {profile.desc ? (
              <p className={styles.desc}>{profile.desc}</p>
            ) : (
              profile.canUpdate && (
                // Nur der Platzhalter, kein zweiter Weg zum Ändern: der steht
                // als „Bearbeiten" schon am rechten Rand derselben Karte. Ohne
                // dieses Recht gibt es dort keinen Knopf — der Platzhalter
                // lädt dann zu nichts ein und bleibt weg, es steht nur der
                // Name.
                <p className={styles.descEmpty}>
                  {t("dashboard.noDescription")}
                </p>
              )
            )}
          </div>

          {/* Ein Link und kein Knopf: die Einstellungen haben eine eigene
              Adresse, und ein Link lässt sich in einem neuen Reiter öffnen.
              Aussehen wie ein Knopf, Verhalten wie ein Link. */}
          {profile.canUpdate && (
            <Link href={links.settings} className={styles.heroEdit}>
              <Icon icon="lucide:pencil" width={14} />
              {t("actions.edit")}
            </Link>
          )}
        </header>

        {/* ── 2. Die Eckdaten ── */}
        <dl className={styles.facts}>
          {facts.map((fact) => (
            <div key={fact.key} className={styles.fact}>
              <dt className={styles.factLabel}>
                <Icon icon={fact.icon} width={13} />
                {fact.label}
              </dt>
              <dd className={styles.factValue}>
                {fact.value}
                {fact.meta && (
                  <span className={styles.factMeta}>{fact.meta}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {/* ── 3. Wer, und womit ── */}
        <div className={styles.columns}>
          <Card
            title={t("nav.teams")}
            count={profile.teams.length}
            empty={profile.teams.length === 0}
            dashed
            action={
              // Teams gehören dem Workspace — verwaltet werden sie also dort,
              // nicht im Projekt. Der Pfeil sagt das: er führt hinaus, ist
              // aber kein Anlegen-Knopf wie bei Labels.
              profile.canManageTeams && (
                <Link
                  href={links.teams}
                  className={[
                    buttonStyles.btn,
                    buttonStyles.text,
                    buttonStyles.sm,
                    buttonStyles.iconOnly,
                  ].join(" ")}
                  aria-label={t("actions.edit")}
                  title={t("actions.edit")}
                >
                  <Icon icon="lucide:arrow-right" width={15} />
                </Link>
              )
            }
          >
            {profile.teams.length === 0 ? (
              t("dashboard.noTeams")
            ) : (
              <ul className={styles.rows}>
                {profile.teams.map((team) => (
                  <li key={team.id}>
                    <span className={styles.row}>
                      <span
                        className={styles.teamKey}
                        style={{ background: team.color }}
                      >
                        {team.key}
                      </span>
                      {team.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title={t("nav.labels")}
            count={profile.labels.length}
            empty={profile.labels.length === 0}
            dashed
            action={
              profile.canCreateLabel && (
                <Button
                  variant="text"
                  size="sm"
                  icon={<Icon icon="lucide:plus" width={15} />}
                  aria-label={t("projectLabels.newLabel")}
                  title={t("projectLabels.newLabel")}
                  onClick={openNewLabel}
                />
              )
            }
          >
            {profile.labels.length === 0 ? (
              t("dashboard.noLabels")
            ) : (
              <ul className={styles.rows}>
                {profile.labels.map((label) => (
                  <li key={label.id}>
                    {/* Ein Klick filtert das Board auf genau dieses Label —
                        dieselbe Sprache wie überall: die URL trägt den Slug,
                        nicht die Id (`lib/filter-slugs.ts`). Derselbe
                        Unterschied wie in den Label-Einstellungen (eigen/
                        geteilt) steht weiterhin im Titel-Tooltip. */}
                    <Link
                      href={`${links.board}?label=${label.slug}`}
                      className={`${styles.row} ${styles.rowLink}`}
                      title={t(
                        label.own
                          ? "dashboard.labelOwn"
                          : "dashboard.labelShared",
                      )}
                    >
                      <span
                        className={styles.labelDot}
                        style={{ background: label.color }}
                        aria-hidden="true"
                      />
                      {label.name}
                      <Icon
                        icon="lucide:arrow-right"
                        width={13}
                        className={styles.rowArrow}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ── Aktivität ── Wer hat wann was getan: Mitglieder, Issues, Labels.
            Immer sichtbar, aber ohne `audit.view` schon serverseitig auf die
            eigenen Einträge gefiltert (`getProjectActivity`) — kein
            Berechtigungs-Gate hier, nur ein anderer Ausschnitt. */}
        <Card
          title={t("nav.activity")}
          count={activity.entries.length}
          empty={activity.entries.length === 0}
          scrollBody
          grow
          footer={
            activity.canViewAll &&
            activity.entries.length > 0 && (
              <Link href={links.activity} className={styles.cardLink}>
                {t("dashboard.allActivity")}
                <Icon icon="lucide:arrow-right" width={13} />
              </Link>
            )
          }
        >
          {activity.entries.length === 0 ? (
            t("dashboard.noActivity")
          ) : (
            <ActivityFeed
              entries={activity.entries}
              workspaceSlug={workspaceId}
            />
          )}
        </Card>
      </div>

      {/* Die Mitglieder als eigene Spalte rechts. */}
      <aside className={styles.side}>
        <Card
          title={t("nav.members")}
          count={profile.memberCount}
          empty={profile.memberCount === 0}
          scrollBody
          footer={
            profile.memberCount > 0 && (
              <Link href={links.members} className={styles.cardLink}>
                {t("dashboard.allMembers")}
                <Icon icon="lucide:arrow-right" width={13} />
              </Link>
            )
          }
        >
          {profile.memberCount === 0 ? (
            t("dashboard.noMembers")
          ) : (
            <>
              {/* Wer mehr trägt als die Mitarbeit, steht einzeln: Zeichen,
                  Name, Adresse — und das Chip mit dem Namen seiner Rolle. Es
                  steht neben dem Namen und nicht am rechten Kartenrand: es sagt
                  etwas über *diese* Person, und über eine halbe Kartenbreite
                  Abstand hinweg wäre der Bezug erst zu suchen. */}
              {named.length > 0 && (
                <ul className={styles.people}>
                  {named.flatMap((role) =>
                    role.members.map((member) => (
                      <li key={member.id} className={styles.person}>
                        <Avatar avatar={member} size={28} />
                        <span className={styles.personText}>
                          <span className={styles.personName}>
                            <span>{fullName(member)}</span>
                            <Label
                              size="sm"
                              filled
                              color={roleColor(role.rank)}
                            >
                              {role.name}
                            </Label>
                          </span>
                          {member.email && (
                            <span className={styles.personMeta}>
                              {member.email}
                            </span>
                          )}
                        </span>
                      </li>
                    )),
                  )}
                </ul>
              )}

              {/* Alle übrigen je Rolle als senkrechte Liste. Die Überschrift
                  trägt den Rollennamen und macht das Chip je Zeile überflüssig —
                  zehnmal „Contributor" untereinander wäre eine Spalte aus
                  demselben Wort. */}
              {rest.map((role) => (
                <div key={role.key} className={styles.roleBlock}>
                  <span className={styles.subLabel}>
                    {role.name}
                    <span className={styles.count}>{role.members.length}</span>
                  </span>
                  <ul className={styles.roster}>
                    {role.members.map((member) => (
                      <li key={member.id} className={styles.rosterRow}>
                        <Avatar avatar={member} size={22} />
                        <span className={styles.rosterName}>
                          {fullName(member)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </Card>
      </aside>

      {/* ── 4. Die Wege hinaus ── */}
      <nav className={styles.next} aria-label={t("dashboard.goOn")}>
        <span className={styles.subLabel}>{t("dashboard.goOn")}</span>
        <ul className={styles.tiles}>
          {shortcuts.map((shortcut) => (
            <li key={shortcut.key}>
              <Link href={shortcut.href} className={styles.tile}>
                <Icon
                  icon={shortcut.icon}
                  width={16}
                  className={styles.tileIcon}
                />
                {t(`nav.${shortcut.key}`)}
                <Icon
                  icon="lucide:arrow-right"
                  width={14}
                  className={styles.tileArrow}
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
