"use client";
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ProjectComposer } from "@/features/projects/components/ProjectComposer/ProjectComposer";
import { Link, usePathname } from "@/i18n/navigation";
import { useWorkspace } from "@/lib/workspace-context";

import styles from "../sidebar.module.scss";

export function NavSection() {
  const { projects, workspace } = useWorkspace();
  const t = useTranslations();
  const pathname = usePathname();
  const base = `/${workspace.id}`;

  const getInitialOpen = () => {
    for (const p of projects) {
      const projPath = `${base}/project/${p.slug}`;
      if (pathname === projPath || pathname.startsWith(`${projPath}/`))
        return p.id;
    }
    return null;
  };

  const [openId, setOpenId] = useState<string | null>(getInitialOpen);

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className="orbit-section-h">{t("settings.projects")}</span>
        <ProjectComposer
          workspaceId={workspace.id}
          trigger={(open) => (
            <button
              type="button"
              className={styles.addProject}
              onClick={open}
              title={t("actions.newProject")}
              aria-label={t("actions.newProject")}
            >
              <Icon icon="lucide:plus" width={14} />
            </button>
          )}
        />
      </div>
      <div className={styles.projectList}>
        {projects.map((p) => {
          const slug = p.slug;
          const projPath = `${base}/project/${slug}`;
          const isProjectActive =
            pathname === projPath || pathname.startsWith(`${projPath}/`);
          const isOpen = openId === p.id;

          return (
            <div key={p.id} className={styles.projectGroup}>
              <button
                type="button"
                className={`orbit-nav ${styles.projectToggle}`}
                data-active={isProjectActive}
                onClick={() => setOpenId(isOpen ? null : p.id)}
              >
                <span
                  className="dot"
                  style={{ background: p.color, width: 9, height: 9 }}
                />
                <span>{p.name}</span>
                <span className={`mono faint ${styles.projectPrefix}`}>
                  {p.prefix}
                </span>
                <Icon
                  icon="lucide:chevron-right"
                  width={12}
                  className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
                />
              </button>
              {isOpen && (
                <div className={styles.projectSubLinks}>
                  <Link
                    href={`${base}/project/${slug}`}
                    className={`orbit-nav ${styles.projectSubLink}`}
                    data-active={
                      !pathname.startsWith(`${base}/project/${slug}/`) &&
                      pathname === `${base}/project/${slug}`
                    }
                  >
                    <Icon icon="lucide:layout-dashboard" width={14} />
                    <span>Board</span>
                  </Link>
                  <Link
                    href={`${base}/project/${slug}/list`}
                    className={`orbit-nav ${styles.projectSubLink}`}
                    data-active={pathname.startsWith(
                      `${base}/project/${slug}/list`,
                    )}
                  >
                    <Icon icon="lucide:list" width={14} />
                    <span>Issues</span>
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
