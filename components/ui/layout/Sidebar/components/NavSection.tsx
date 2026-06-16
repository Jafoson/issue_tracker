"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUI } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace-context";
import { getT } from "@/lib/i18n";
import styles from "../sidebar.module.scss";

export function NavSection() {
  const { ui } = useUI();
  const { projects } = useWorkspace();
  const t = getT(ui.locale);
  const pathname = usePathname();

  return (
    <div className={styles.section}>
      <div className="orbit-section-h">{t.settings.projects}</div>
      <div className={styles.projectList}>
        {projects.map((p) => {
          const active = pathname === `/board/${p.id}` || pathname === `/list/${p.id}`;
          return (
            <Link key={p.id} href={`/board/${p.id}`} className="orbit-nav" data-active={active}>
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
