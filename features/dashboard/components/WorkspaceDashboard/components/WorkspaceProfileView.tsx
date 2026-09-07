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
  /** Name, color, and id are used in the header card, or needed by the creation dialogs. */
  workspace: {
    id: string;
    name: string;
    color: string;
    avatarUrl: string | null;
  };
  workspaceSlug: string;
  profile: WorkspaceProfile;
  stats: DashboardStats;
  /** Addresses of the neighboring areas — the tile row below links to them. */
  links: {
    projects: string;
    members: string;
    teams: string;
    settings: string;
    /** The full, filterable list — the card below shows only an excerpt. */
    activity: string;
  };
  /** Excerpt of the activity log — without `audit.view` already filtered to
   * your own entries (`getWorkspaceActivity`). */
  activity: ActivityView;
}

interface CardProps {
  title: string;
  count?: number;
  empty?: boolean;
  /** Dashed border regardless of content — for list cards that should
   * always look this way, not only when empty. */
  dashed?: boolean;
  /** Button top-right next to title and count, e.g. to create something. */
  action?: ReactNode;
  /**
   * For the members card: the content scrolls within itself instead of
   * stretching the card (and with it the whole page) arbitrarily long — with
   * many members, the title and "all members" stay reachable this way,
   * without having to scroll past them first.
   */
  scrollBody?: boolean;
  /**
   * For the activity card: it claims whatever space is left over in `.main`
   * after the header card, key facts, and teams/projects. `.main` is a flex
   * column with no externally determined height — unlike `.side`, which
   * `.page` stretches automatically via `align-items: stretch`. Only makes
   * sense together with `scrollBody`.
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
      {/* Scrolls as a whole (header, list, footer) instead of just the rows
          in between — otherwise the scrollbar wouldn't cover the card's
          full height. Header and footer still stay in place:
          `position: sticky`, see `.card[data-scroll] .cardHead`/`.cardLink`
          in the stylesheet. */}
      {scrollBody ? (
        <div className={styles.cardScroll}>{content}</div>
      ) : (
        content
      )}
    </section>
  );
}

/**
 * The workspace's profile card: what it is, who owns it, what it consists of.
 *
 * The same layout as `ProjectProfileView` one level down — header card, key
 * facts, two cards, ways out — just without a purpose sentence and prefix:
 * the workspace has neither. In place of labels, its list of projects steps
 * in, answering the question "what does this consist of" here.
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

  // Candidates for the team dialog are the workspace members — already
  // available here as a flat list, because the profile card has loaded
  // them grouped by role anyway; a separate query just for the dialog
  // would be redundant.
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

  // Without member.view, the tile would lead straight into a 404 — the
  // page behind it is now just as locked as the tab (`getWorkspaceMembersView`).
  // Without canViewSettings, the tile would otherwise remain the only door
  // to settings, even though the sidebar tab for it is already hidden.
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
        {/* ── 1. Who am I ── */}
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
              // As in `ProjectProfileView`: without `canUpdate` there's no
              // "edit" button the placeholder could invite you to — then
              // only the name remains.
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

        {/* Important addresses directly below the header card — large chips
            instead of another card, because it isn't a list of records but
            a handful of ways out. */}
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

        {/* ── 2. The key facts ── */}
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

        {/* ── 3. Teams and projects ── */}
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
                        size={18}
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

        {/* ── Activity ── Who created which project, who was added, etc.
            Always visible, but without `audit.view` already filtered
            server-side to your own entries (`getWorkspaceActivity`). */}
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

      {/* Members as their own column on the right. Without `member.view`,
          only leadership (`named`) and platform access remain —
          `profile.roles` is already filtered server-side for that
          (`wsProfileFor`). The column disappears entirely only once truly
          nothing is left of it. The header count and the link to the full
          list stay tied to `canViewMembers`: the page behind it is locked
          without that permission anyway, and the count would reveal the
          full roster, which is precisely what shouldn't be shown here. */}
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

      {/* ── 4. The ways out ── */}
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
