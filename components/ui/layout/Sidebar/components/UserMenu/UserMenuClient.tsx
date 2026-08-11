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
import { Popover } from "@/components/ui/atoms/Popover/Popover";
import { NavLink } from "@/components/ui/layout/NavLink/NavLink";
import { logout } from "@/features/auth/actions";
import { fullName } from "@/lib/utils/string";
import styles from "./UserMenu.module.scss";

interface UserMenuClientProps {
  me: PersonAvatarData;
  /**
   * Weg zu den eigenen Einstellungen. `null`, wenn es keinen Workspace gibt, in
   * dem sie stehen könnten — dann fehlt der Eintrag.
   */
  settingsHref: string | null;
}

/**
 * Das eigene Menü unten in der Seitenleiste.
 *
 * Zwei Einträge, in dieser Reihenfolge: erst die eigenen Einstellungen — das ist
 * der Weg, den man regelmäßig geht —, dann das Abmelden. Zwischen beiden eine
 * Linie: das eine führt weiter, das andere hinaus, und beides direkt
 * untereinander wäre eine Einladung zum Verklicken.
 */
function UserMenuClient({ me, settingsHref }: UserMenuClientProps) {
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
        <span className={styles.title}>{fullName(me)}</span>
      </Button>

      <span className={styles.bellSlot}>
        <Button
          variant="ghost"
          size="md"
          icon={<Icon icon="lucide:bell" height={20} />}
        />
        <Badge size="sm" active className={styles.bellBadge}>
          <span>9</span>
        </Badge>
      </span>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        side="bottom"
        width={210}
      >
        <>
          {settingsHref && (
            <>
              {/* Dieselbe Zeile wie in der Seitenleiste und in den
                  Einstellungsleisten — ein Menüeintrag, der woandershin führt,
                  ist ein Link und soll sich auch so verhalten (Mittelklick,
                  „in neuem Tab öffnen"). */}
              <NavLink
                href={settingsHref}
                activeHref={`${settingsHref}/*`}
                icon="lucide:settings"
                label={t("settings")}
                onClick={() => setOpen(false)}
              />
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
        </>
      </Popover>
    </div>
  );
}

export default UserMenuClient;
