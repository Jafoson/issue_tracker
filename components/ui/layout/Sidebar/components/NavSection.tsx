"use client";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState } from "react";
import { toProjectSlug } from "@/lib/slug";
import { useTranslations } from "@/lib/translations-context";
import { useWorkspace } from "@/lib/workspace-context";

import styles from "../sidebar.module.scss";

export function NavSection() {
  const { projects } = useWorkspace();
  const t = useTranslations();
  const pathname = usePathname();
  const { locale, workspace } = useParams<{
    locale: string;
    workspace: string;
  }>();
  const base = `/${locale}/${workspace}`;

  const getInitialOpen = () => {
    for (const p of projects) {
      if (pathname.startsWith(`${base}/project/${toProjectSlug(p.name)}`))
        return p.id;
    }
    return null;
  };

  const [openId, setOpenId] = useState<string | null>(getInitialOpen);

  return (
    <div className={styles.section}>
      <div className="orbit-section-h">{t.settings.projects}</div>
      <div className={styles.projectList}>
        {projects.map((p) => {
          const slug = toProjectSlug(p.name);
          const isProjectActive = pathname.startsWith(
            `${base}/project/${slug}`,
          );
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
