"use client";
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { AvatarStack } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";

import { useWorkspace } from "@/lib/workspace-context";

import type { Issue, Project, Team, User } from "@/types";
import styles from "./teams.module.scss";

interface Props {
  teams: Team[];
  members: User[];
  projects: Project[];
  allIssues: Issue[];
}

export function Teams({ teams, members, projects, allIssues }: Props) {
  const { me } = useWorkspace();
  const t = useTranslations();
  const isAdmin = me.role === "admin" || me.role === "owner";

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>{t("teams.title")}</h2>
        {isAdmin && (
          <Button
            variant="primary"
            icon={<Icon icon="lucide:plus" width={15} />}
          >
            {t("actions.newTeam")}
          </Button>
        )}
      </div>

      <div className={styles.grid}>
        {teams.map((team) => {
          const teamMembers = members.filter((m) =>
            team.members.includes(m.id),
          );
          const teamProjects = projects.filter((p) =>
            team.projects.includes(p.id),
          );
          const openIssues = allIssues.filter(
            (i) =>
              teamProjects.some((p) => p.id === i.project) &&
              i.status !== "done" &&
              i.status !== "canceled",
          );

          return (
            <div key={team.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span
                  className="dot"
                  style={{ background: team.color, width: 11, height: 11 }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {team.name}
                  </div>
                  <div className="faint mono" style={{ fontSize: 11 }}>
                    {team.key}
                  </div>
                </div>
              </div>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.statNum}>{openIssues.length}</span>
                  <span className="faint" style={{ fontSize: 11.5 }}>
                    {t("teams.openIssues")}
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNum}>{teamProjects.length}</span>
                  <span className="faint" style={{ fontSize: 11.5 }}>
                    {t("teams.projects")}
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNum}>{teamMembers.length}</span>
                  <span className="faint" style={{ fontSize: 11.5 }}>
                    {t("teams.members")}
                  </span>
                </div>
              </div>
              <div className={styles.cardFooter}>
                <AvatarStack
                  ids={team.members}
                  users={members}
                  size={24}
                  max={5}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
