"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { RoleChip } from "@/features/roles/components/RoleChip/RoleChip";
import type { RoleView } from "@/features/roles/types";
import styles from "./roleCards.module.scss";

interface Props {
  roles: RoleView[];
  /** Wie viele Permissions es in diesem Scope überhaupt gibt. */
  total: number;
  /**
   * Woraufhin die Trägerzahl gezählt wurde, als fertiger Satz für den Tooltip.
   * Die Karte zählt nicht selbst — sie sagt nur dazu, worüber.
   */
  carriersHint: string;
  /** Rollen, deren Spalte gerade nicht in der Matrix steht. */
  hidden: ReadonlySet<string>;
  /** Rolle, deren Stammdaten gerade bearbeitet werden. */
  editingId: string | null;
  onToggle: (roleId: string) => void;
  onEdit: (roleId: string | null) => void;
}

/**
 * Der Überblick über der Matrix: eine Karte je Rolle — und zugleich der
 * Schalter für ihre Spalte.
 *
 * Die Matrix zeigt jede einzelne Entscheidung, aber keine Beschreibung — dafür
 * ist eine Spalte zu schmal. Beides nebeneinander zu legen wäre Wiederholung;
 * hier steht deshalb, *wofür* eine Rolle gedacht ist, dort, was sie konkret darf.
 *
 * Ein Klick auf die Karte nimmt die Spalte aus der Matrix und holt sie zurück,
 * wie die Legende eines Diagramms ihre Reihen schaltet. Die Karte bleibt dabei
 * stehen — ausgeblendet ist sie gestrichelt und blass, und sie ist der einzige
 * Weg zurück. Das Bearbeiten hängt am Stift daneben: es betrifft nur die
 * wenigsten Rollen, während sich ausblenden lässt, was immer im Weg steht.
 *
 * Eine Zeile, die quer scrollt statt umzubrechen: so wächst der Überblick in
 * dieselbe Richtung wie die Spalten darunter, und die Höhe bleibt planbar.
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
        const grants = Object.values(role.grants);
        const allow = grants.filter((e) => e === "ALLOW").length;
        const deny = grants.filter((e) => e === "DENY").length;
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
              // Gedrückt heißt „steht in der Matrix" — der Schalter meint die
              // Spalte, nicht die Rolle.
              aria-pressed={!off}
              title={off ? t("roles.showColumn") : t("roles.hideColumn")}
              onClick={() => onToggle(role.id)}
            >
              <span className={styles.top}>
                {/* Kein Zeichen für „geteilt": dass eine Standardrolle nicht
                    bearbeitet werden kann, sagt schon der ausgegraute Chip und
                    das Schloss daneben. Projektlokal bleibt: das ist keine
                    Sperre, sondern die Herkunft einer Rolle, die es nur hier
                    gibt. */}
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
                {deny > 0 && (
                  <span className={styles.deny} title={t("roles.denied")}>
                    −{deny}
                  </span>
                )}
                <span className={styles.carriers} title={carriersHint}>
                  {t("roles.carriers", { count: role.memberCount })}
                </span>
              </span>
            </button>

            {/* Stift und Schloss teilen sich die Ecke — es gibt immer nur eins
                von beiden. */}
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
