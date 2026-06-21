"use client";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Popover } from "@/components/ui/atoms/Popover/Popover";
import { useTranslations } from "@/lib/translations-context";
import { useWorkspace } from "@/lib/workspace-context";
import styles from "../sidebar.module.scss";
import { NavLink } from "./NavLink";

interface UserMenuProps {
  onLogout: () => void;
}

export function UserMenu({ onLogout }: UserMenuProps) {
  const { me } = useWorkspace();
  const t = useTranslations();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { locale, workspace } = useParams<{
    locale: string;
    workspace: string;
  }>();
  const base = `/${locale}/${workspace}`;
  const inboxActive = pathname === `${base}/inbox`;

  return (
    <div ref={ref} className={styles.userRow}>
      <button
        type="button"
        className="orbit-user"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: "none",
        }}
      >
        <Avatar user={me} size={28} />
        <span
          style={{
            display: "block",
            textAlign: "left",
            lineHeight: 1.2,
            minWidth: 0,
          }}
        >
          <span
            style={{
              display: "block",
              fontWeight: 550,
              fontSize: 13,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {me.name}
          </span>
          <span
            className="faint"
            style={{
              display: "block",
              fontSize: 11,
              textTransform: "capitalize",
            }}
          >
            {me.role}
          </span>
        </span>
      </button>

      <Link
        href={`${base}/inbox`}
        className={`iconbtn${inboxActive ? " active" : ""}`}
        style={{ position: "relative", flex: "none", marginRight: 4 }}
      >
        <Icon icon="lucide:bell" width={16} />
        <Badge
          variant="count"
          style={{
            position: "absolute",
            top: -5,
            right: -5,
            fontSize: 9,
            minWidth: 14,
            height: 14,
            padding: "0 3px",
          }}
        >
          3
        </Badge>
      </Link>

      <Popover
        anchorRef={ref}
        open={open}
        onClose={() => setOpen(false)}
        side="top"
        width={230}
      >
        <div
          style={{
            padding: "8px 9px 6px",
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <Avatar user={me} size={32} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{me.name}</div>
            <div
              className="faint"
              style={{
                fontSize: 11.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {me.email}
            </div>
          </div>
        </div>
        <div className="divider" style={{ margin: "4px 0" }} />
        <NavLink
          href={`${base}/inbox`}
          icon="lucide:bell"
          label={t.nav.inbox}
          active={pathname === `${base}/inbox`}
          onClick={() => setOpen(false)}
        />
        <NavLink
          href={`${base}/settings`}
          icon="lucide:settings"
          label={t.nav.settings}
          active={pathname === `${base}/settings`}
          onClick={() => setOpen(false)}
        />
        <div className="divider" style={{ margin: "4px 0" }} />
        <button type="button" className="menu-item" onClick={onLogout}>
          <Icon icon="lucide:log-out" width={16} className="faint" />{" "}
          {t.nav.signOut}
        </button>
      </Popover>
    </div>
  );
}
