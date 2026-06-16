"use client";
import { useTranslations } from "@/lib/translations-context";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Popover } from "@/components/ui/atoms/Popover/Popover";
import { NavLink } from "./NavLink";

import { useWorkspace } from "@/lib/workspace-context";

import styles from "../sidebar.module.scss";

interface UserMenuProps {
  onLogout: () => void;
}

export function UserMenu({ onLogout }: UserMenuProps) {

  const { me } = useWorkspace();
  const t = useTranslations();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { locale, workspace } = useParams<{ locale: string; workspace: string }>();
  const base = `/${locale}/w/${workspace}`;
  const inboxActive = pathname === `${base}/inbox`;

  return (
    <div
      ref={ref}
      className={styles.userRow}
      onClick={() => setOpen((o) => !o)}
    >
      <div className="orbit-user" style={{ flex: 1, minWidth: 0, background: "transparent", border: "none" }}>
        <Avatar user={me} size={28} />
        <div style={{ textAlign: "left", lineHeight: 1.2, minWidth: 0 }}>
          <div style={{ fontWeight: 550, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{me.name}</div>
          <div className="faint" style={{ fontSize: 11, textTransform: "capitalize" }}>{me.role}</div>
        </div>
      </div>

      <Link
        href={`${base}/inbox`}
        className={`iconbtn${inboxActive ? " active" : ""}`}
        style={{ position: "relative", flex: "none", marginRight: 4 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Icon icon="lucide:bell" width={16} />
        <Badge variant="count" style={{ position: "absolute", top: -5, right: -5, fontSize: 9, minWidth: 14, height: 14, padding: "0 3px" }}>3</Badge>
      </Link>

      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} side="top" width={230}>
        <div style={{ padding: "8px 9px 6px", display: "flex", gap: 10, alignItems: "center" }}>
          <Avatar user={me} size={32} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{me.name}</div>
            <div className="faint" style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis" }}>{me.email}</div>
          </div>
        </div>
        <div className="divider" style={{ margin: "4px 0" }} />
        <NavLink href={`${base}/inbox`}    icon="lucide:bell"     label={t.nav.inbox}    active={pathname === `${base}/inbox`}    onClick={() => setOpen(false)} />
        <NavLink href={`${base}/settings`} icon="lucide:settings" label={t.nav.settings} active={pathname === `${base}/settings`} onClick={() => setOpen(false)} />
        <div className="divider" style={{ margin: "4px 0" }} />
        <div className="menu-item" onClick={onLogout}>
          <Icon icon="lucide:log-out" width={16} className="faint" /> {t.nav.signOut}
        </div>
      </Popover>
    </div>
  );
}
