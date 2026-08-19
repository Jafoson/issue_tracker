"use client";

import { Icon } from "@iconify/react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Chip } from "@/components/ui/atoms/Chip/Chip";
import { Label } from "@/components/ui/atoms/Label/Label";
import { ActivityFeed } from "@/features/audit/components/ActivityFeed/ActivityFeed";
import type { ActivityView } from "@/features/audit/queries";
import type {
  DashboardStats,
  WorkspaceProfile,
} from "@/features/dashboard/types";
import { NewProjectButton } from "@/features/projects/components/NewProjectButton/NewProjectButton";
import { TeamModal } from "@/features/workspaces/components/WorkspaceTeams/components/TeamModal";
import { Link, useRouter } from "@/i18n/navigation";
import { useModal } from "@/lib/context";
import { projectPath } from "@/lib/nav";
import { roleColor } from "@/lib/rbac";
import { fullName } from "@/lib/utils/string";
import styles from "./workspaceProfileView.module.scss";

interface Props {
  /** Name, Farbe und Id stehen in der Kopfkarte bzw. brauchen die Dialoge zum Anlegen. */
  workspace: {
    id: string;
    name: string;
    color: string;
    avatarUrl: string | null;
  };
  workspaceSlug: string;
  profile: WorkspaceProfile;
  stats: DashboardStats;
  /** Adressen der Nachbarbereiche — die Kachelreihe unten verlinkt sie. */
  links: {
    projects: string;
    members: string;
    teams: string;
    settings: string;
    /** Die volle, filterbare Liste — die Karte unten zeigt nur einen Ausschnitt. */
    activity: string;
  };
  /** Ausschnitt des Aktivitäts-Protokolls — ohne `audit.view` schon auf die
   * eigenen Einträge gefiltert (`getWorkspaceActivity`). */
  activity: ActivityView;
}

interface CardProps {
  title: string;
  count?: number;
  empty?: boolean;
  /** Gestrichelter Rahmen unabhängig vom Inhalt — für Listen-Cards, die immer
   * so aussehen sollen, nicht nur wenn sie leer sind. */
  dashed?: boolean;
  /** Knopf oben rechts neben Titel und Zahl, z. B. zum Anlegen. */
  action?: ReactNode;
  /**
   * Für die Mitgliederkarte: der Inhalt scrollt in sich selbst, statt die
   * Karte (und mit ihr die ganze Seite) beliebig in die Länge zu ziehen — bei
   * vielen Mitgliedern bleiben Titel und „Alle Mitglieder" so erreichbar, ohne
   * dass man sich erst an ihnen vorbeischrollen muss.
   */
  scrollBody?: boolean;
  /**
   * Für die Aktivitäts-Karte: sie nimmt sich den Platz, der nach Kopfkarte,
   * Eckdaten und Teams/Projekte in `.main` noch übrig ist. `.main` ist eine
   * Flex-Spalte ohne fremdbestimmte Höhe — anders als `.side`, das `.page`
   * per `align-items: stretch` automatisch dehnt. Ergibt nur zusammen mit
   * `scrollBody` einen Sinn.
   */
  grow?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

function Card({
  title,
  count,
  empty,
  dashed,
  action,
  scrollBody,
  grow,
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
 * Der Steckbrief des Workspace: was er ist, wem er gehört, woraus er besteht.
 *
 * Dieselbe Anordnung wie `ProjectProfileView` eine Ebene tiefer — Kopfkarte,
 * Eckdaten, zwei Karten, Wege hinaus —, nur ohne Zweck-Satz und Kürzel: der
 * Workspace kennt beides nicht. An die Stelle der Labels rückt seine Liste der
 * Projekte, die hier die Frage „woraus besteht das hier" beantwortet.
 */
export function WorkspaceProfileView({
  workspace,
  workspaceSlug,
  profile,
  stats,
  links,
  activity,
}: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const { openModal } = useModal();

  // Kandidaten für den Team-Dialog sind die Workspace-Mitglieder — hier schon
  // als flache Liste da, weil der Steckbrief sie ohnehin nach Rolle gruppiert
  // geladen hat; eine eigene Abfrage nur für den Dialog wäre doppelt.
  const candidates = profile.roles.flatMap((role) => role.members);

  const openNewTeam = () =>
    openModal(({ close }) => (
      <TeamModal
        workspaceId={workspace.id}
        candidates={candidates}
        projects={profile.projects}
        assignableProjectRoles={profile.assignableProjectRoles}
        canManageMembers={profile.canManageTeamMembers}
        canManageProjects={profile.canManageTeamProjects}
        onDone={() => router.refresh()}
        close={close}
      />
    ));

  const created = format.dateTime(new Date(profile.createdAt), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const facts = [
    {
      key: "created",
      icon: "lucide:calendar",
      label: t("fields.created"),
      value: created,
    },
    {
      key: "projects",
      icon: "lucide:folders",
      label: t("nav.projects"),
      value: format.number(profile.projects.length),
    },
    {
      key: "issues",
      icon: "lucide:circle-dot",
      label: t("dashboard.issues"),
      value: t("dashboard.issuesOpen", { count: stats.open }),
      meta: t("dashboard.issuesTotal", { count: stats.total }),
    },
  ];

  // Ohne member.view führte die Kachel geradewegs in ein 404 — die Seite
  // dahinter ist jetzt genauso gesperrt wie der Tab (`getWorkspaceMembersView`).
  // Ohne canViewSettings bliebe die Kachel sonst die einzige Tür zu den
  // Einstellungen, obwohl der Sidebar-Tab dafür längst ausgeblendet ist.
  const shortcuts = (
    [
      { key: "projects", icon: "lucide:folders", href: links.projects },
      { key: "members", icon: "lucide:users", href: links.members },
      { key: "teams", icon: "lucide:users-round", href: links.teams },
      { key: "settings", icon: "lucide:settings", href: links.settings },
    ] as const
  ).filter(
    (s) =>
      (s.key !== "members" || profile.canViewMembers) &&
      (s.key !== "settings" || profile.canViewSettings),
  );

  const named = profile.roles.filter((role) => role.distinguished);
  const rest = profile.roles.filter((role) => !role.distinguished);

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        {/* ── 1. Wer bin ich ── */}
        <header className={styles.hero}>
          <Avatar
            avatar={{
              name: workspace.name,
              color: workspace.color,
              image: workspace.avatarUrl ?? undefined,
            }}
            shape="square"
            size={92}
          />

          <div className={styles.heroText}>
            <h2 className={styles.heroName}>{workspace.name}</h2>
            {profile.desc ? (
              <p className={styles.desc}>{profile.desc}</p>
            ) : (
              // Wie in `ProjectProfileView`: ohne `canUpdate` gibt es keinen
              // „Bearbeiten"-Knopf, zu dem der Platzhalter einladen könnte —
              // dann bleibt nur der Name.
              profile.canUpdate && (
                <p className={styles.descEmpty}>
                  {t("dashboard.noDescription")}
                </p>
              )
            )}
          </div>

          {profile.canUpdate && (
            <Link href={links.settings} className={styles.heroEdit}>
              <Icon icon="lucide:pencil" width={14} />
              {t("actions.edit")}
            </Link>
          )}
        </header>

        {/* Wichtige Adressen direkt unter der Kopfkarte — große Chips statt
            einer weiteren Karte, weil es keine Liste von Datensätzen ist,
            sondern eine Handvoll Wege nach draußen. */}
        {profile.links.length > 0 && (
          <ul className={styles.links}>
            {profile.links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.linkChip}
                >
                  <Chip
                    as="span"
                    size="lg"
                    variant="elevated"
                    icon={<Icon icon="lucide:link" width={16} />}
                  >
                    {link.label}
                  </Chip>
                </a>
              </li>
            ))}
          </ul>
        )}

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
                {"meta" in fact && fact.meta && (
                  <span className={styles.factMeta}>{fact.meta}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {/* ── 3. Teams und Projekte ── */}
        <div className={styles.columns}>
          <Card
            title={t("nav.teams")}
            count={profile.teams.length}
            empty={profile.teams.length === 0}
            dashed
            action={
              profile.canCreateTeam && (
                <Button
                  variant="text"
                  icon={<Icon icon="lucide:plus" width={15} />}
                  aria-label={t("actions.newTeam")}
                  title={t("actions.newTeam")}
                  onClick={openNewTeam}
                />
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
            title={t("nav.projects")}
            count={profile.projects.length}
            empty={profile.projects.length === 0}
            dashed
            action={
              profile.canCreateProject && (
                <NewProjectButton workspaceId={workspace.id} compact />
              )
            }
          >
            {profile.projects.length === 0 ? (
              t("dashboard.noProjects")
            ) : (
              <ul className={styles.rows}>
                {profile.projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={projectPath(workspaceSlug, project.slug, "")}
                      className={`${styles.row} ${styles.rowLink}`}
                    >
                      <Avatar
                        avatar={{
                          name: project.name,
                          color: project.color,
                          image: project.avatarUrl ?? undefined,
                        }}
                        shape="square"
                        size={20}
                      />
                      {project.name}
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

        {/* ── Aktivität ── Wer hat welches Projekt angelegt, wen aufgenommen,
            usw. Immer sichtbar, aber ohne `audit.view` schon serverseitig auf
            die eigenen Einträge gefiltert (`getWorkspaceActivity`). */}
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
              workspaceSlug={workspaceSlug}
            />
          )}
        </Card>
      </div>

      {/* Die Mitglieder als eigene Spalte rechts. Ohne `member.view` bleibt nur
          die Leitung (`named`) und der Plattform-Zugriff übrig — `profile.roles`
          ist dafür serverseitig schon gefiltert (`wsProfileFor`). Ganz weg fällt
          die Spalte erst, wenn wirklich nichts davon übrig bleibt. Kopfzahl und
          Link zur vollen Liste bleiben an `canViewMembers` hängen: die Seite
          dahinter ist ohne das Recht ohnehin gesperrt, und die Zahl verriete die
          volle Besetzung, die genau hier nicht gezeigt werden soll. */}
      {(profile.canViewMembers ||
        named.length > 0 ||
        profile.platformStaff.length > 0) && (
        <aside className={styles.side}>
          <Card
            title={t("nav.members")}
            count={profile.canViewMembers ? profile.memberCount : undefined}
            empty={
              profile.canViewMembers &&
              profile.memberCount === 0 &&
              profile.platformStaff.length === 0
            }
            scrollBody
            footer={
              profile.canViewMembers &&
              profile.memberCount > 0 && (
                <Link href={links.members} className={styles.cardLink}>
                  {t("dashboard.allMembers")}
                  <Icon icon="lucide:arrow-right" width={13} />
                </Link>
              )
            }
          >
            {profile.canViewMembers &&
            profile.memberCount === 0 &&
            profile.platformStaff.length === 0 ? (
              t("dashboard.noMembers")
            ) : (
              <>
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

                {rest.map((role) => (
                  <div key={role.key} className={styles.roleBlock}>
                    <span className={styles.subLabel}>
                      {role.name}
                      <span className={styles.count}>
                        {role.members.length}
                      </span>
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

                {profile.platformStaff.length > 0 && (
                  <div className={styles.roleBlock}>
                    <span
                      className={styles.subLabel}
                      title={t("dashboard.platformAccessHint")}
                    >
                      {t("dashboard.platformAccess")}
                    </span>
                    <ul className={styles.people}>
                      {profile.platformStaff.flatMap((role) =>
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
                  </div>
                )}
              </>
            )}
          </Card>
        </aside>
      )}

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
