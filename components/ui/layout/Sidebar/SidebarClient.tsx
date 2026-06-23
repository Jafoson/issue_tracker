"use client";

import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "@/lib/translations-context";
import { useWorkspace } from "@/lib/workspace-context";
import { AdminNav } from "./components/AdminNav";
import { NavLink } from "./components/NavLink";
import { NavSection } from "./components/NavSection";
import { QuickActions } from "./components/QuickActions";
import { UserMenu } from "./components/UserMenu";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import styles from "./sidebar.module.scss";

interface SidebarClientProps {
  onLogout: () => void;
}

export function SidebarClient({ onLogout }: SidebarClientProps) {
  const t = useTranslations();
  const pathname = usePathname();
  // Die Workspace-ID kommt aus dem Context (nicht aus der URL), damit dieselbe
  // Sidebar auch im plattformweiten /admin-Bereich (ohne [workspace]-Segment) trägt.
  const { isPlatformAdmin, workspace } = useWorkspace();
  const { locale } = useParams<{ locale: string }>();
  const base = `/${locale}/${workspace.id}`;

  // Plattformweiter Admin-Bereich: eigene Kategorie-Sidebar, gleiche Shell.
  const adminBase = `/${locale}/admin`;
  const isAdminMode =
    pathname === adminBase || pathname.startsWith(`${adminBase}/`);
  if (isAdminMode) {
    return <AdminNav onLogout={onLogout} />;
  }

  const navTop: Array<
    | {
        href: string;
        icon: string;
        label: string;
        badge?: number;
      }
    | "separator"
  > = [
    { href: `${base}/my`, icon: "lucide:user", label: t.nav.myIssues },
    "separator",
    { href: `${base}/projects`, icon: "lucide:folders", label: t.nav.projects },
  ];

  const navBottom = [
    { href: `${base}/members`, icon: "lucide:users", label: t.nav.members },
    { href: `${base}/teams`, icon: "lucide:users-2", label: t.nav.teams },
    ...(isPlatformAdmin
      ? [
          {
            href: `/${locale}/admin`,
            icon: "lucide:shield",
            label: t.nav.adminSettings,
          },
        ]
      : []),
  ];

  const isActive = (href: string) =>
    pathname === href ||
    (href.includes("/project/") &&
      !href.endsWith("/list") &&
      pathname.startsWith(`${base}/project/`) &&
      !pathname.endsWith("/list")) ||
    (href.endsWith("/list") && pathname.endsWith("/list"));

  return (
    <aside className={styles.aside}>
      <WorkspaceMenu />

      <QuickActions t={t} />

      <nav className={styles.nav}>
        {navTop.map((item) =>
          item === "separator" ? (
            <div key="nav-separator" style={{ height: 10 }} />
          ) : (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href)}
              badge={item.badge}
            />
          ),
        )}
      </nav>

      <NavSection />

      <div style={{ marginTop: "auto" }} />

      <nav className={styles.nav}>
        {navBottom.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={isActive(item.href)}
          />
        ))}
      </nav>

      <UserMenu onLogout={onLogout} />
    </aside>
  );
}
