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
import { logout } from "@/features/auth/actions";
import { fullName } from "@/lib/utils/string";
import styles from "./UserMenu.module.scss";

interface UserMenuClientProps {
  me: PersonAvatarData;
}

function UserMenuClient({ me }: UserMenuClientProps) {
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

// add UserSettings and Notifications in the future
