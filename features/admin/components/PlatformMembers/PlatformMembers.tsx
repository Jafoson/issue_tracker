"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import type { PlatformUser } from "@/features/admin/queries";
import styles from "./platformMembers.module.scss";

interface Props {
  users: PlatformUser[];
}

export function PlatformMembers({ users }: Props) {
  const t = useTranslations();

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>{t("platform.membersTitle")}</h2>
      </div>
      <p className={styles.subtitle}>{t("platform.membersDesc")}</p>

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>{t("platform.colUser")}</span>
          <span>{t("platform.colEmail")}</span>
          <span>{t("platform.colWorkspaces")}</span>
        </div>
        {users.map((u) => (
          <div key={u.id} className={styles.row}>
            <div className={styles.userCell}>
              <Avatar
                user={{
                  id: u.id,
                  name: u.name,
                  handle: u.handle,
                  email: u.email,
                  color: u.color,
                  role: "",
                }}
                size={32}
              />
              <div>
                <div className={styles.userName}>
                  {u.name}
                  {u.isPlatformAdmin && (
                    <Badge size="sm" active>
                      {t("platform.platformAdmin")}
                    </Badge>
                  )}
                </div>
                <div className="faint" style={{ fontSize: 12 }}>
                  @{u.handle}
                </div>
              </div>
            </div>
            <span className="faint" style={{ fontSize: 13 }}>
              {u.email}
            </span>
            <span style={{ fontSize: 13 }}>{u.workspaceCount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
