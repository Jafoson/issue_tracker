"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/atoms/Input/Input";
import type { RoleView } from "@/features/roles/types";
import styles from "./roleEditor.module.scss";

interface Props {
  role: RoleView;
  /** Highest rank the actor is allowed to assign. */
  maxRank: number;
  pending: boolean;
  onUpdate: (patch: { name?: string; desc?: string; rank?: number }) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * A role's core data — name, description, rank, delete.
 *
 * Sits as a strip between the cards and the matrix instead of in a dialog:
 * what's changed here is immediately visible next to the card it belongs
 * to. The permissions themselves don't belong here, those live in the
 * column below.
 *
 * Applied on blur; every change is its own write, so there's nothing to
 * save and nothing to discard.
 */
export function RoleEditor({
  role,
  maxRank,
  pending,
  onUpdate,
  onDelete,
  onClose,
}: Props) {
  const t = useTranslations();

  return (
    <div className={styles.editor}>
      <Input
        size="sm"
        label={t("roles.fieldName")}
        defaultValue={role.name}
        disabled={pending}
        onBlur={(e) => {
          const name = e.target.value.trim();
          if (name && name !== role.name) onUpdate({ name });
        }}
      />
      <Input
        size="sm"
        label={t("roles.fieldDesc")}
        defaultValue={role.desc}
        disabled={pending}
        onBlur={(e) => {
          const desc = e.target.value.trim();
          if (desc !== role.desc) onUpdate({ desc });
        }}
      />
      <Input
        size="sm"
        label={t("roles.fieldRank")}
        defaultValue={String(role.rank)}
        inputMode="numeric"
        disabled={pending}
        // Without a role of your own in scope, the limit is infinite — in
        // that case the hint has nothing to say and is left out.
        hint={
          Number.isFinite(maxRank)
            ? t("roles.rankHint", { max: maxRank })
            : undefined
        }
        onBlur={(e) => {
          const rank = Number(e.target.value);
          if (Number.isFinite(rank) && rank !== role.rank) onUpdate({ rank });
        }}
      />

      <div className={styles.meta}>
        <code className={styles.key}>{role.key}</code>

        {/* As long as anyone carries the role, the action rejects deletion
            anyway — so the button doesn't even appear. Counted for this
            across every pool: the foreign key knows no boundaries, and a
            role carried only next door would otherwise leave a button that
            doesn't do what it promises. */}
        {role.totalCarriers === 0 ? (
          <button
            type="button"
            className={styles.delete}
            disabled={pending}
            onClick={() => {
              if (confirm(t("roles.confirmDelete"))) onDelete();
            }}
          >
            <Icon icon="lucide:trash-2" width={13} />
            {t("actions.delete")}
          </button>
        ) : (
          <span className={styles.inUse}>
            {/* If nobody carries the role here but someone does elsewhere,
                only the second number explains why it can't be deleted. */}
            {role.memberCount > 0
              ? t("roles.carriers", { count: role.memberCount })
              : t("roles.carriersElsewhere", { count: role.totalCarriers })}
          </span>
        )}
      </div>

      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label={t("actions.close")}
        title={t("actions.close")}
      >
        <Icon icon="lucide:x" width={14} />
      </button>
    </div>
  );
}
