"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import type { RoleView } from "@/features/roles/types";
import type { PermissionEffect } from "@/lib/rbac";
import styles from "./permissionMatrix.module.scss";

interface Props {
  role: RoleView;
  /** Permissions, die in diesem Scope vergeben werden dürfen. */
  permissions: { key: string; desc: string }[];
  /** Permissions, die der Handelnde per ALLOW weitergeben darf. */
  grantable: string[];
  /** Ganze Matrix schreibgeschützt (geteilte Rolle oder kein Recht). */
  readOnly: boolean;
  onChange: (permission: string, effect: PermissionEffect | null) => void;
  busy: string | null;
}

/**
 * Ein Eintrag hat drei Zustände: nicht gesetzt, erlaubt, verboten.
 *
 * Das Verbot ist eine eigene Wahl und nicht bloß die Abwesenheit einer
 * Erlaubnis — weil sich die Scopes vereinigen, nimmt „nicht gesetzt" nichts weg,
 * was ein anderer Scope bereits gewährt. Nur DENY tut das.
 *
 * Gruppiert wird nach dem ersten Namensteil des Keys, also nach dem Objekt, um
 * das es geht (`issue.*`, `label.*`, …). Der Key nennt nur Objekt und Aktion;
 * wo die Permission wirkt, sagt der Scope der Rolle.
 */
export function PermissionMatrix({
  role,
  permissions,
  grantable,
  readOnly,
  onChange,
  busy,
}: Props) {
  const t = useTranslations();
  const canGrant = new Set(grantable);

  const groups = groupByObject(permissions);

  return (
    <div className={styles.matrix}>
      {groups.map((group) => (
        <section key={group.name} className={styles.group}>
          <h4 className={styles.groupTitle}>{group.name}</h4>

          <ul className={styles.perms}>
            {group.permissions.map((permission) => {
              const effect = role.grants[permission.key] ?? null;
              // Erlauben kann nur, wer es selbst darf. Verbieten immer — ein
              // Verbot vergrößert niemandes Rechte.
              const allowLocked = !canGrant.has(permission.key);
              const pending = busy === permission.key;

              return (
                <li
                  key={permission.key}
                  className={styles.perm}
                  data-effect={effect ?? "unset"}
                  data-pending={pending || undefined}
                >
                  <div className={styles.permText}>
                    <code className={styles.permKey}>{permission.key}</code>
                    <span className={styles.permDesc}>{permission.desc}</span>
                  </div>

                  <fieldset className={styles.tristate}>
                    <Choice
                      active={effect === null}
                      disabled={readOnly || pending}
                      title={t("roles.effectUnset")}
                      icon="lucide:minus"
                      onClick={() => onChange(permission.key, null)}
                    />
                    <Choice
                      active={effect === "ALLOW"}
                      disabled={readOnly || pending || allowLocked}
                      title={
                        allowLocked
                          ? t("roles.allowLocked")
                          : t("roles.effectAllow")
                      }
                      icon="lucide:check"
                      onClick={() => onChange(permission.key, "ALLOW")}
                    />
                    <Choice
                      active={effect === "DENY"}
                      disabled={readOnly || pending}
                      title={t("roles.effectDeny")}
                      icon="lucide:ban"
                      onClick={() => onChange(permission.key, "DENY")}
                    />
                  </fieldset>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Nach dem ersten Namensteil bündeln, Reihenfolge wie hereingegeben. */
function groupByObject(permissions: { key: string; desc: string }[]) {
  const order: string[] = [];
  const byObject = new Map<string, { key: string; desc: string }[]>();

  for (const permission of permissions) {
    const object = permission.key.split(".")[0];
    if (!byObject.has(object)) {
      byObject.set(object, []);
      order.push(object);
    }
    byObject.get(object)?.push(permission);
  }

  return order.map((object) => ({
    name: object.charAt(0).toUpperCase() + object.slice(1),
    permissions: byObject.get(object) ?? [],
  }));
}

function Choice({
  active,
  disabled,
  title,
  icon,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  title: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.choice}
      data-active={active || undefined}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
    >
      <Icon icon={icon} width={14} />
    </button>
  );
}
