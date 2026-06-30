"use client";
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { DEFAULT_ROLES, PERMISSION_DESCRIPTIONS } from "@/lib/rbac";
import styles from "./roles.module.scss";

export function Roles() {
  const t = useTranslations();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>{t("roles.title")}</h2>
      </div>
      <p className={styles.subtitle}>{t("roles.subtitle")}</p>

      <div className={styles.list}>
        {DEFAULT_ROLES.map((role) => {
          const permissions = role.permissions;
          const isOpen = openId === role.key;

          return (
            <div key={role.key} className={styles.card} data-open={isOpen}>
              <button
                type="button"
                className={styles.cardHeader}
                onClick={() => setOpenId(isOpen ? null : role.key)}
                aria-expanded={isOpen}
              >
                <span className={styles.roleName}>{role.name}</span>
                <Badge>{permissions.length}</Badge>
                <span className={styles.cardDesc}>{role.desc}</span>
                <Icon
                  icon="lucide:chevron-right"
                  width={15}
                  className={styles.chevron}
                />
              </button>

              {isOpen && (
                <ul className={styles.perms}>
                  {permissions.length === 0 ? (
                    <li className={styles.permEmpty}>
                      {t("roles.noPermissions")}
                    </li>
                  ) : (
                    permissions.map((perm) => (
                      <li key={perm} className={styles.perm}>
                        <Icon
                          icon="lucide:check"
                          width={14}
                          className={styles.permCheck}
                        />
                        <div className={styles.permText}>
                          <code className={styles.permKey}>{perm}</code>
                          <span className={styles.permDesc}>
                            {PERMISSION_DESCRIPTIONS[perm]}
                          </span>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
