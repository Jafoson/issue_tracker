"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { Input } from "@/components/ui/atoms/Input/Input";
import { Label } from "@/components/ui/atoms/Label/Label";
import {
  createRole,
  deleteRole,
  setRoleGrant,
  updateRole,
} from "@/features/roles/actions";
import { PermissionMatrix } from "@/features/roles/components/PermissionMatrix/PermissionMatrix";
import type { RoleManagerView as View } from "@/features/roles/types";
import { type PermissionEffect, roleColor } from "@/lib/rbac";
import styles from "./roleManagerView.module.scss";

interface Props {
  view: View;
  title: string;
  subtitle: string;
}

/**
 * Rollen eines Topfes anzeigen und bearbeiten.
 *
 * Dieselbe Komponente bedient alle drei Scopes — was sich unterscheidet, steht
 * im `target` und in den vom Server bereits ausgerechneten Grenzen
 * (`manageable`, `grantable`, `maxRank`). Die Oberfläche kennt weder
 * Rollennamen noch Rangregeln.
 *
 * Geteilte System-Rollen erscheinen mit, sind aber gesperrt: sie sind für alle
 * Mandanten dieselbe Zeile. Sichtbar bleiben sie, damit nachvollziehbar ist,
 * was etwa „Member" gewährt.
 */
export function RoleManagerView({ view, title, subtitle }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyPermission, setBusyPermission] = useState<string | null>(null);

  // Jede Aktion gibt entweder `ok` oder einen Text zurück. Der Fehler landet
  // sichtbar über der Liste statt still in der Konsole.
  const run = (action: () => Promise<{ ok: true } | { error: string }>) =>
    startTransition(async () => {
      const result = await action();
      setError("error" in result ? result.error : null);
      setBusyPermission(null);
      if (!("error" in result)) router.refresh();
    });

  const submitNew = () => {
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      const result = await createRole(view.target, { name });
      if (!("error" in result)) {
        setNewName("");
        setCreating(false);
      }
      return result;
    });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>{title}</h2>
        {view.canManage && (
          <Button
            variant="primary"
            icon={<Icon icon="lucide:plus" width={15} />}
            onClick={() => setCreating((v) => !v)}
          >
            {t("roles.newRole")}
          </Button>
        )}
      </div>
      <p className={styles.subtitle}>{subtitle}</p>

      {error && (
        <p className={styles.error} role="alert">
          <Icon icon="lucide:triangle-alert" width={14} />
          {error}
        </p>
      )}

      {creating && (
        <div className={styles.createRow}>
          <Input
            autoFocus
            placeholder={t("roles.newRolePlaceholder")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNew();
              if (e.key === "Escape") setCreating(false);
            }}
          />
          <Button variant="primary" onClick={submitNew} disabled={pending}>
            {t("actions.create")}
          </Button>
          <Button variant="text" onClick={() => setCreating(false)}>
            {t("actions.cancel")}
          </Button>
        </div>
      )}

      {view.roles.length === 0 ? (
        <EmptyState
          icon={<Icon icon="lucide:shield" width={32} />}
          title={t("roles.emptyTitle")}
          description={t("roles.emptyDesc")}
        />
      ) : (
        <div className={styles.list}>
          {view.roles.map((role) => {
            const isOpen = openId === role.id;
            const grantCount = Object.values(role.grants).filter(
              (e) => e === "ALLOW",
            ).length;
            const denyCount = Object.values(role.grants).filter(
              (e) => e === "DENY",
            ).length;

            return (
              <div key={role.id} className={styles.card} data-open={isOpen}>
                <button
                  type="button"
                  className={styles.cardHeader}
                  onClick={() => setOpenId(isOpen ? null : role.id)}
                  aria-expanded={isOpen}
                >
                  <Label size="sm" filled color={roleColor(role.rank)}>
                    {role.name}
                  </Label>

                  <span className={styles.counts}>
                    <span
                      className={styles.allowCount}
                      title={t("roles.allowed")}
                    >
                      {grantCount}
                    </span>
                    {denyCount > 0 && (
                      <span
                        className={styles.denyCount}
                        title={t("roles.denied")}
                      >
                        {denyCount}
                      </span>
                    )}
                  </span>

                  <span className={styles.cardDesc}>{role.desc}</span>

                  {role.system && (
                    <span className={styles.tag}>{t("roles.sharedTag")}</span>
                  )}
                  {role.local && (
                    <span className={styles.tag}>{t("roles.localTag")}</span>
                  )}
                  {!role.manageable && (
                    <Icon
                      icon="lucide:lock"
                      width={13}
                      className={styles.lock}
                      aria-label={t("roles.locked")}
                    />
                  )}

                  <Icon
                    icon="lucide:chevron-right"
                    width={15}
                    className={styles.chevron}
                  />
                </button>

                {isOpen && (
                  <div className={styles.body}>
                    <div className={styles.meta}>
                      <code className={styles.key}>{role.key}</code>
                      <span className={styles.rank}>
                        {t("roles.rank")}: {role.rank}
                      </span>
                      <span className={styles.carriers}>
                        {t("roles.carriers", { count: role.memberCount })}
                      </span>
                      {role.manageable && role.memberCount === 0 && (
                        <button
                          type="button"
                          className={styles.delete}
                          disabled={pending}
                          onClick={() => {
                            if (confirm(t("roles.confirmDelete")))
                              run(() => deleteRole(role.id));
                          }}
                        >
                          <Icon icon="lucide:trash-2" width={13} />
                          {t("actions.delete")}
                        </button>
                      )}
                    </div>

                    {role.manageable && (
                      <div className={styles.editRow}>
                        <Input
                          size="sm"
                          label={t("roles.fieldName")}
                          defaultValue={role.name}
                          onBlur={(e) => {
                            const name = e.target.value.trim();
                            if (name && name !== role.name)
                              run(() => updateRole(role.id, { name }));
                          }}
                        />
                        <Input
                          size="sm"
                          label={t("roles.fieldDesc")}
                          defaultValue={role.desc}
                          onBlur={(e) => {
                            const desc = e.target.value.trim();
                            if (desc !== role.desc)
                              run(() => updateRole(role.id, { desc }));
                          }}
                        />
                        <Input
                          size="sm"
                          label={t("roles.fieldRank")}
                          defaultValue={String(role.rank)}
                          inputMode="numeric"
                          onBlur={(e) => {
                            const rank = Number(e.target.value);
                            if (Number.isFinite(rank) && rank !== role.rank)
                              run(() => updateRole(role.id, { rank }));
                          }}
                        />
                      </div>
                    )}

                    <PermissionMatrix
                      role={role}
                      permissions={view.permissions}
                      grantable={view.grantable}
                      readOnly={!role.manageable}
                      busy={busyPermission}
                      onChange={(
                        permission,
                        effect: PermissionEffect | null,
                      ) => {
                        setBusyPermission(permission);
                        run(() => setRoleGrant(role.id, permission, effect));
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
