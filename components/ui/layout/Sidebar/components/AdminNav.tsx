"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useWorkspace } from "@/lib/workspace-context";
import styles from "../sidebar.module.scss";
import { NavLink } from "./NavLink";
import { UserMenu } from "./UserMenu";

interface AdminNavProps {
  onLogout: () => void;
}

// Kategorie-Sidebar des plattformweiten /admin-Bereichs. Läuft innerhalb der
// normalen AppShell (gleiche Topbar, Tabs und Context wie der Workspace-Bereich).
export function AdminNav({ onLogout }: AdminNavProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { workspace } = useWorkspace();
  const base = "/admin";
  const backHref = `/${workspace.id}`;

  const items = [
    { href: base, icon: "lucide:settings", label: t("nav.general") },
    { href: `${base}/members`, icon: "lucide:users", label: t("nav.members") },
    {
      href: `${base}/roles`,
      icon: "lucide:shield-check",
      label: t("nav.roles"),
    },
  ];

  // Die Übersicht (/admin) ist nur exakt aktiv; Unterseiten matchen per Präfix.
  const isActive = (href: string) =>
    pathname === href || (href !== base && pathname.startsWith(`${href}/`));

  return (
    <aside className={styles.aside}>
      <button
        type="button"
        className={styles.adminBack}
        onClick={() => router.push(backHref)}
        title={t("nav.backToWorkspace")}
      >
        <Icon icon="lucide:arrow-left" width={16} />
        <span>{t("nav.admin")}</span>
      </button>

      <nav className={styles.nav}>
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={isActive(item.href)}
          />
        ))}
      </nav>

      <div style={{ marginTop: "auto" }} />

      <UserMenu onLogout={onLogout} />
    </aside>
  );
}
