"use client";

import { usePathname } from "next/navigation";
import { useUI } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace-context";
import { getT } from "@/lib/i18n";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { QuickActions } from "./components/QuickActions";
import { NavLink } from "./components/NavLink";
import { NavSection } from "./components/NavSection";
import { UserMenu } from "./components/UserMenu";
import styles from "./sidebar.module.scss";

interface SidebarClientProps {
  onLogout: () => void;
}

export function SidebarClient({ onLogout }: SidebarClientProps) {
  const { ui } = useUI();
  const { projects } = useWorkspace();
  const t = getT(ui.locale);
  const pathname = usePathname();
  const projectId = projects[0]?.id ?? "";

  const navTop: Array<{ href: string; icon: string; label: string; badge?: number } | null> = [
    { href: "/my",                   icon: "lucide:user",             label: t.nav.myIssues },
    null,
    { href: `/board/${projectId}`,   icon: "lucide:layout-dashboard", label: t.nav.board },
    { href: `/list/${projectId}`,    icon: "lucide:list",             label: t.nav.issues },
  ];

  const navBottom = [
    { href: "/members", icon: "lucide:users",   label: t.nav.members },
    { href: "/teams",   icon: "lucide:users-2", label: t.nav.teams   },
  ];


  const isActive = (href: string) =>
    pathname === href ||
    (href.includes("/board/") && pathname.startsWith("/board/")) ||
    (href.includes("/list/")  && pathname.startsWith("/list/"));

  return (
    <aside className={styles.aside}>
      <WorkspaceMenu onLogout={onLogout} />

      <QuickActions t={t} />

      <nav className={styles.nav}>
        {navTop.map((item, i) => {
          if (item === null) return <div key={i} style={{ height: 10 }} />;
          return <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} active={isActive(item.href)} badge={item.badge} />;
        })}
      </nav>

      <NavSection />

      <div style={{ marginTop: "auto" }} />

      <nav className={styles.nav}>
        {navBottom.map((item) => (
          <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} active={isActive(item.href)} />
        ))}
      </nav>

      <UserMenu onLogout={onLogout} />
    </aside>
  );
}
