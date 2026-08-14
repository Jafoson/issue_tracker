"use client";

import { Icon } from "@iconify/react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Chip } from "@/components/ui/atoms/Chip/Chip";
import { Label } from "@/components/ui/atoms/Label/Label";
import type {
  DashboardStats,
  WorkspaceProfile,
} from "@/features/dashboard/types";
import { Link } from "@/i18n/navigation";
import { projectPath } from "@/lib/nav";
import { roleColor } from "@/lib/rbac";
import { fullName } from "@/lib/utils/string";
import styles from "./workspaceProfileView.module.scss";

interface Props {
  /** Name und Farbe stehen in der Kopfkarte — das Zeichen des Workspace. */
  workspace: { name: string; color: string };
  workspaceSlug: string;
  profile: WorkspaceProfile;
  stats: DashboardStats;
  /** Adressen der Nachbarbereiche — die Kachelreihe unten verlinkt sie. */
  links: {
    projects: string;
    members: string;
    teams: string;
    settings: string;
  };
}

interface CardProps {
  title: string;
  count?: number;
  empty?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

function Card({ title, count, empty, footer, children }: CardProps) {
  return (
    <section className={styles.card} data-empty={empty || undefined}>
      <h3 className={styles.cardTitle}>
        {title}
        {count !== undefined && <span className={styles.count}>{count}</span>}
      </h3>
      <div className={styles.cardBody}>{children}</div>
      {footer}
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
}: Props) {
  const t = useTranslations();
  const format = useFormatter();

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

  const shortcuts = [
    { key: "projects", icon: "lucide:folders", href: links.projects },
    { key: "members", icon: "lucide:users", href: links.members },
    { key: "teams", icon: "lucide:users-round", href: links.teams },
    { key: "settings", icon: "lucide:settings", href: links.settings },
  ] as const;

  const named = profile.roles.filter((role) => role.distinguished);
  const rest = profile.roles.filter((role) => !role.distinguished);

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        {/* ── 1. Wer bin ich ── */}
        <header className={styles.hero}>
          <Avatar
            avatar={{ name: workspace.name, color: workspace.color }}
            shape="square"
            size={92}
          />

          <div className={styles.heroText}>
            <h2 className={styles.heroName}>{workspace.name}</h2>
            {profile.desc ? (
              <p className={styles.desc}>{profile.desc}</p>
            ) : (
              <p className={styles.descEmpty}>{t("dashboard.noDescription")}</p>
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
          >
            {profile.teams.length === 0 ? (
              t("dashboard.noTeams")
            ) : (
              <ul className={styles.chips}>
                {profile.teams.map((team) => (
                  <li key={team.id}>
                    <span className={styles.team}>
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
          >
            {profile.projects.length === 0 ? (
              t("dashboard.noProjects")
            ) : (
              <ul className={styles.chips}>
                {profile.projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={projectPath(workspaceSlug, project.slug, "")}
                      className={styles.team}
                    >
                      <span
                        className={styles.projectDot}
                        style={{ background: project.color }}
                        aria-hidden="true"
                      />
                      {project.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Die Mitglieder als eigene Spalte rechts. */}
      <aside className={styles.side}>
        <Card
          title={t("nav.members")}
          count={profile.memberCount}
          empty={profile.memberCount === 0}
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
                          <span className={styles.personMeta}>
                            {member.email}
                          </span>
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
