"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { RoleChip } from "@/features/roles/components/RoleChip/RoleChip";
import type { RoleView } from "@/features/roles/types";
import styles from "./roleCards.module.scss";

interface Props {
  roles: RoleView[];
  /** How many permissions exist at all in this scope. */
  total: number;
  /**
   * What the carrier count was tallied against, as a ready-made sentence
   * for the tooltip. The card doesn't count itself — it just says what over.
   */
  carriersHint: string;
  /** Roles whose column is currently not shown in the matrix. */
  hidden: ReadonlySet<string>;
  /** Role whose core data is currently being edited. */
  editingId: string | null;
  onToggle: (roleId: string) => void;
  onEdit: (roleId: string | null) => void;
}

/**
 * The overview above the matrix: one card per role — and at the same time
 * the toggle for its column.
 *
 * The matrix shows every single decision but no description — a column is
 * too narrow for that. Putting both side by side would be repetition; so
 * here is *what* a role is meant for, there what it specifically allows.
 *
 * Clicking a card removes the column from the matrix and brings it back,
 * like a chart's legend toggling its series. The card itself stays put —
 * hidden, it's dashed and faded, and it's the only way back. Editing hangs
 * off the pencil icon next to it: it concerns only the fewest roles, while
 * hiding works for whatever happens to be in the way.
 *
 * A row that scrolls horizontally instead of wrapping: this way the
 * overview grows in the same direction as the columns below it, and the
 * height stays predictable.
 */
export function RoleCards({
  roles,
  total,
  carriersHint,
  hidden,
  editingId,
  onToggle,
  onEdit,
}: Props) {
  const t = useTranslations();

  return (
    <div className={styles.cards}>
      {roles.map((role) => {
        const allow = role.grants.length;
        const editing = editingId === role.id;
        const off = hidden.has(role.id);

        return (
          <div
            key={role.id}
            className={styles.card}
            data-hidden={off || undefined}
            data-editing={editing || undefined}
          >
            <button
              type="button"
              className={styles.face}
              // Pressed means "is in the matrix" — the toggle refers to the
              // column, not the role.
              aria-pressed={!off}
              title={off ? t("roles.showColumn") : t("roles.hideColumn")}
              onClick={() => onToggle(role.id)}
            >
              <span className={styles.top}>
                {/* No marker for "shared": that a default role can't be
                    edited is already said by the grayed-out chip and the
                    lock next to it. Project-local stays: that isn't a
                    restriction, it's the origin of a role that only exists
                    here. */}
                <RoleChip
                  name={role.name}
                  rank={role.rank}
                  tag={role.local ? t("roles.localTag") : null}
                  locked={!role.manageable}
                />

                {off && (
                  <Icon
                    icon="lucide:eye-off"
                    width={13}
                    className={styles.offMark}
                    aria-hidden
                  />
                )}
              </span>

              <span className={styles.desc}>{role.desc || "—"}</span>

              <span className={styles.counts}>
                <span className={styles.allow} title={t("roles.permissions")}>
                  {t("roles.grantCount", { count: allow, total })}
                </span>
                <span className={styles.carriers} title={carriersHint}>
                  {t("roles.carriers", { count: role.memberCount })}
                </span>
              </span>
            </button>

            {/* Pencil and lock share the corner — there's always only one
                of the two. */}
            {role.manageable ? (
              <button
                type="button"
                className={styles.edit}
                aria-expanded={editing}
                aria-label={t("roles.editRole")}
                title={t("roles.editRole")}
                onClick={() => onEdit(editing ? null : role.id)}
              >
                <Icon icon="lucide:pencil" width={13} />
              </button>
            ) : (
              <span
                className={styles.lock}
                title={
                  role.system ? t("roles.sharedLocked") : t("roles.locked")
                }
              >
                <Icon
                  icon="lucide:lock"
                  width={13}
                  aria-label={
                    role.system ? t("roles.sharedLocked") : t("roles.locked")
                  }
                />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
