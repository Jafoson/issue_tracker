"use client";
import { useTranslations } from "@/lib/translations-context";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

import { useWorkspace } from "@/lib/workspace-context";

import styles from "../sidebar.module.scss";

export function NavSection() {

  const { projects } = useWorkspace();
  const t = useTranslations();
  const pathname = usePathname();
  const { locale, workspace } = useParams<{ locale: string; workspace: string }>();
  const base = `/${locale}/w/${workspace}`;

  return (
    <div className={styles.section}>
      <div className="orbit-section-h">{t.settings.projects}</div>
      <div className={styles.projectList}>
        {projects.map((p) => {
          const active = pathname === `${base}/board/${p.id}` || pathname === `${base}/list/${p.id}`;
          return (
            <Link key={p.id} href={`${base}/board/${p.id}`} className="orbit-nav" data-active={active}>
              <span className="dot" style={{ background: p.color, width: 9, height: 9 }} />
              <span>{p.name}</span>
              <span className="mono faint" style={{ marginLeft: "auto", fontSize: 11 }}>{p.prefix}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
