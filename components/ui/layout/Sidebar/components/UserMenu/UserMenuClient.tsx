"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import {
  Avatar,
  type PersonAvatarData,
} from "@/components/ui/atoms/Avatar/Avatar";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import buttonStyles from "@/components/ui/atoms/Button/button.module.scss";
import { Popover } from "@/components/ui/atoms/Popover/Popover";
import { NavLink } from "@/components/ui/layout/NavLink/NavLink";
import { logout } from "@/features/auth/actions";
import { Link } from "@/i18n/navigation";
import { fullName } from "@/lib/utils/string";
import styles from "./UserMenu.module.scss";

interface UserMenuClientProps {
  me: PersonAvatarData;
  /**
   * Weg zu den eigenen Einstellungen. `null`, wenn es keinen Workspace gibt, in
   * dem sie stehen könnten — dann fehlt der Eintrag.
   */
  settingsHref: string | null;
  /** Weg zur Inbox. `null` aus demselben Grund wie `settingsHref`. */
  inboxHref: string | null;
  /**
   * Weg in die Plattformverwaltung. `null` ohne `platform.access` — dann fehlt
   * der Eintrag ganz, statt ihn nur auszugrauen (siehe `UserMenu`).
   */
  adminHref: string | null;
  /** Ungelesene Benachrichtigungen im aktiven Workspace. */
  unreadCount: number;
}

/**
 * Das eigene Menü unten in der Seitenleiste.
 *
 * Einträge, die weiterführen, zuerst — Einstellungen, dann (für die wenigsten)
 * die Plattformverwaltung —, dann das Abmelden. Zwischen beiden Gruppen eine
 * Linie: das eine führt weiter, das andere hinaus, und beides direkt
 * untereinander wäre eine Einladung zum Verklicken.
 */
function UserMenuClient({
  me,
  settingsHref,
  inboxHref,
  adminHref,
  unreadCount,
}: UserMenuClientProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");

  return (
    <div className={styles.wrapper} ref={ref}>
      <Button
        onClick={() => setOpen(!open)}
        variant="elevated"
        full
        textAlign="left"
        icon={<Avatar avatar={me} size={28} />}
        className={styles.trigger}
        style={{ height: "48px", borderRadius: "var(--radius)" }}
      >
        <span className={styles.title}>
          {fullName(me) || (me.handle ? `@${me.handle}` : "")}
        </span>
      </Button>

      {inboxHref && (
        <span className={styles.bellSlot}>
          <Link
            href={inboxHref}
            aria-label={t("inbox")}
            className={[
              buttonStyles.btn,
              buttonStyles.ghost,
              buttonStyles.md,
              buttonStyles.iconOnly,
            ].join(" ")}
          >
            <Icon icon="lucide:bell" height={20} />
          </Link>
          {unreadCount > 0 && (
            <Badge size="sm" active className={styles.bellBadge}>
              <span>{unreadCount > 99 ? "99+" : unreadCount}</span>
            </Badge>
          )}
        </span>
      )}
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        side="bottom"
        width={210}
      >
        {(settingsHref || adminHref) && (
          <>
            {/* Dieselbe Zeile wie in der Seitenleiste und in den
                Einstellungsleisten — ein Menüeintrag, der woandershin führt,
                ist ein Link und soll sich auch so verhalten (Mittelklick,
                „in neuem Tab öffnen"). */}
            {settingsHref && (
              <NavLink
                href={settingsHref}
                activeHref={`${settingsHref}/*`}
                icon="lucide:settings"
                label={t("settings")}
                onClick={() => setOpen(false)}
              />
            )}
            {adminHref && (
              <NavLink
                href={adminHref}
                activeHref={`${adminHref}/*`}
                icon="lucide:shield"
                label={t("admin")}
                onClick={() => setOpen(false)}
              />
            )}
            <hr className={styles.divider} />
          </>
        )}
        <Button
          variant="ghost"
          size="lg"
          full
          icon={<Icon icon="lucide:log-out" height={16} />}
          textAlign="left"
          onClick={() => {
            logout();
            setOpen(false);
          }}
        >
          {t("signOut")}
        </Button>
      </Popover>
    </div>
  );
}

export default UserMenuClient;
