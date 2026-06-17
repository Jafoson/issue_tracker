"use client";
import { useTranslations } from "@/lib/translations-context";

import { usePathname, useParams } from "next/navigation";

import { useWorkspace } from "@/lib/workspace-context";
import { toProjectSlug } from "@/lib/slug";

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

  const { projects } = useWorkspace();
  const t = useTranslations();
  const pathname = usePathname();
  const { locale, workspace } = useParams<{ locale: string; workspace: string }>();
  const base = `/${locale}/${workspace}`;
  const firstProjectSlug = projects[0] ? toProjectSlug(projects[0].name) : "";

  const navTop: Array<{ href: string; icon: string; label: string; badge?: number } | null> = [
    { href: `${base}/my`,                           icon: "lucide:user",             label: t.nav.myIssues },
    null,
    { href: `${base}/project/${firstProjectSlug}`,  icon: "lucide:layout-dashboard", label: t.nav.board },
    { href: `${base}/project/${firstProjectSlug}/list`, icon: "lucide:list",         label: t.nav.issues },
  ];

  const navBottom = [
    { href: `${base}/members`, icon: "lucide:users",   label: t.nav.members },
    { href: `${base}/teams`,   icon: "lucide:users-2", label: t.nav.teams   },
  ];

  const isActive = (href: string) =>
    pathname === href ||
    (href.includes("/project/") && !href.endsWith("/list") && pathname.startsWith(`${base}/project/`) && !pathname.endsWith("/list")) ||
    (href.endsWith("/list")     && pathname.endsWith("/list"));

  return (
    <aside className={styles.aside}>
      <WorkspaceMenu />

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
