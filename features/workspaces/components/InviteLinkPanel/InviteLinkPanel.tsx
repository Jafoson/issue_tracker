"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { CopyField } from "@/components/ui/atoms/CopyField/CopyField";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { Label } from "@/components/ui/atoms/Label/Label";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { revokeInviteLink } from "@/features/workspaces/actions";
import type { ActiveInviteLink } from "@/features/workspaces/types";
import { roleColor } from "@/lib/rbac";
import type { Role } from "@/types";
import styles from "./inviteLinkPanel.module.scss";

type ExpiryChoice = "never" | "7" | "30";

interface Props {
  activeLink: ActiveInviteLink | null;
  assignableRoles: Role[];
  canManage: boolean;
  /** `createWorkspaceInviteLink`/`createProjectInviteLink`, an die jeweilige
   * Id gebunden — der einzige Unterschied zwischen den beiden Scopes. */
  create: (
    role: string,
    expiresAt?: Date,
  ) => Promise<
    { ok: true; url: string; expiresAt: Date | null } | { error: string }
  >;
}

/**
 * Der teilbare Einladungslink eines Scopes — ein Link pro Rolle-Kombination
 * gleichzeitig aktiv (`createInviteLink` widerruft den vorherigen). Neu
 * erzeugen ersetzt den bestehenden Link stillschweigend; Widerrufen macht ihn
 * ohne Ersatz ungültig.
 */
export function InviteLinkPanel({
  activeLink,
  assignableRoles,
  canManage,
  create,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState(
    activeLink?.roleId ??
      assignableRoles.find((r) => r.id === "member")?.id ??
      assignableRoles.at(-1)?.id ??
      "",
  );
  const [expiry, setExpiry] = useState<ExpiryChoice>("never");
  const [error, setError] = useState("");

  const selected = assignableRoles.find((r) => r.id === role);

  const generate = () => {
    if (!role || isPending) return;
    setError("");
    const expiresAt =
      expiry === "never"
        ? undefined
        : new Date(Date.now() + Number(expiry) * 24 * 60 * 60 * 1000);

    startTransition(async () => {
      const result = await create(role, expiresAt);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const revoke = () => {
    if (!activeLink || isPending) return;
    startTransition(async () => {
      const result = await revokeInviteLink(activeLink.token);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError("");
      router.refresh();
    });
  };

  if (!canManage || assignableRoles.length === 0) return null;

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <h2 className={styles.title}>{t("inviteLink.title")}</h2>
        <p className={styles.desc}>{t("inviteLink.desc")}</p>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          <Icon icon="lucide:circle-alert" width={14} />
          {error}
        </p>
      )}

      {activeLink ? (
        <div className={styles.active}>
          <CopyField
            value={activeLink.url}
            copyLabel={t("members.inviteLinkCopy")}
            copiedLabel={t("members.inviteLinkCopied")}
          />
          <p className={styles.activeMeta}>
            {t("inviteLink.activeMeta", {
              role: activeLink.roleName,
              expiry: activeLink.expiresAt
                ? activeLink.expiresAt.toLocaleDateString()
                : t("inviteLink.never"),
            })}
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={revoke}
          >
            {t("inviteLink.revoke")}
          </Button>
        </div>
      ) : (
        <div className={styles.create}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("fields.role")}</span>
            <InlinePicker
              trigger={
                <button type="button" className={styles.roleTrigger}>
                  <Label
                    size="sm"
                    filled
                    color={roleColor(selected?.rank ?? 0)}
                  >
                    {selected?.name ?? role}
                  </Label>
                  <Icon icon="lucide:chevron-down" width={14} />
                </button>
              }
              width={220}
              stop
            >
              {(close) => (
                <SelectMenu
                  items={assignableRoles.map((r) => ({
                    value: r.id,
                    label: r.name,
                    hint: r.desc,
                  }))}
                  value={role}
                  onPick={(value) => {
                    setRole(String(value));
                    close();
                  }}
                  onClose={close}
                />
              )}
            </InlinePicker>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("inviteLink.expires")}</span>
            <InlinePicker
              trigger={
                <button type="button" className={styles.roleTrigger}>
                  {expiry === "never"
                    ? t("inviteLink.never")
                    : t("inviteLink.expiresInDays", { count: Number(expiry) })}
                  <Icon icon="lucide:chevron-down" width={14} />
                </button>
              }
              width={180}
              stop
            >
              {(close) => (
                <SelectMenu
                  items={[
                    { value: "never", label: t("inviteLink.never") },
                    {
                      value: "7",
                      label: t("inviteLink.expiresInDays", { count: 7 }),
                    },
                    {
                      value: "30",
                      label: t("inviteLink.expiresInDays", { count: 30 }),
                    },
                  ]}
                  value={expiry}
                  onPick={(value) => {
                    setExpiry(value as ExpiryChoice);
                    close();
                  }}
                  onClose={close}
                />
              )}
            </InlinePicker>
          </div>

          <Button
            variant="elevated"
            icon={<Icon icon="lucide:link" width={14} />}
            disabled={!role || isPending}
            onClick={generate}
          >
            {t("inviteLink.generate")}
          </Button>
        </div>
      )}
    </section>
  );
}
