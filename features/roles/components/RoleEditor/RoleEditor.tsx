"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/atoms/Input/Input";
import type { RoleView } from "@/features/roles/types";
import styles from "./roleEditor.module.scss";

interface Props {
  role: RoleView;
  /** Höchster Rang, den der Handelnde vergeben darf. */
  maxRank: number;
  pending: boolean;
  onUpdate: (patch: { name?: string; desc?: string; rank?: number }) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Stammdaten einer Rolle — Name, Beschreibung, Rang, Löschen.
 *
 * Steht als Streifen zwischen Karten und Matrix statt in einem Dialog: was hier
 * geändert wird, ist unmittelbar neben der Karte sichtbar, zu der es gehört.
 * Die Berechtigungen selbst gehören nicht hierher, die stehen in der Spalte
 * darunter.
 *
 * Übernommen wird beim Verlassen des Feldes; jede Änderung ist ein eigener
 * Schreibvorgang, also gibt es nichts zu speichern und nichts zu verwerfen.
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
        // Ohne eigene Rolle im Scope ist die Grenze unendlich — dann sagt der
        // Hinweis nichts und bleibt weg.
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

        {/* Solange jemand die Rolle trägt, lehnt die Action das Löschen ohnehin
            ab — der Knopf erscheint dann gar nicht erst. Gezählt wird dafür
            über alle Töpfe: der Fremdschlüssel kennt keine Ausschnitte, und
            eine Rolle, die nur nebenan getragen wird, bliebe sonst ein Knopf,
            der nicht tut, was er verspricht. */}
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
            {/* Steht die Rolle hier bei niemandem, aber anderswo schon, dann
                erklärt nur die zweite Zahl, warum nicht gelöscht werden kann. */}
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
