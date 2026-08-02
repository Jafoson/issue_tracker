"use client";

import { useTranslations } from "next-intl";
import { EditableText } from "@/components/ui/layout/EditableText/EditableText";
import styles from "./issueTitleField.module.scss";

interface IssueTitleFieldProps {
  value: string;
  /** Läuft beim Verlassen des Feldes — und nur, wenn sich etwas geändert hat. */
  onSave: (title: string) => void;
  /** Das Schreiben ist vorbei; der Aufrufer zeigt wieder seine Ansicht. */
  onDone: () => void;
  /** Typografie der Umgebung — das Feld soll aussehen wie der Titel davor. */
  className?: string;
}

/**
 * Der Titel eines Issues, an Ort und Stelle geschrieben — auf der Board-Karte
 * wie in der Liste. Beide zeigen denselben Text an derselben Stelle, also soll
 * er sich auch gleich anfassen und gleich wieder verlassen lassen.
 *
 * Die Hülle ist kein Bedienelement, sondern zweierlei Wache: Sie fängt Klicks
 * ab, die sonst im Aufrufer landen (die Karte öffnete sonst das Issue), und sie
 * merkt am durchziehenden `focusout`, dass das Schreiben vorbei ist —
 * `EditableText` übernimmt in genau diesem Moment.
 */
export function IssueTitleField({
  value,
  onSave,
  onDone,
  className,
}: IssueTitleFieldProps) {
  const t = useTranslations();

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: kein Bedienelement, das Feld darin bringt seine Tastatur mit
    // biome-ignore lint/a11y/noStaticElementInteractions: nur Riegel und Fokuswächter um das Feld
    <div
      className={[styles.field, className].filter(Boolean).join(" ")}
      onClick={(event) => event.stopPropagation()}
      onBlur={onDone}
    >
      <EditableText
        autoFocus
        singleLine
        value={value}
        label={t("fields.title")}
        placeholder={t("placeholders.issueTitle")}
        saveLabel={t("actions.save")}
        cancelLabel={t("actions.cancel")}
        onCommit={onSave}
      />
    </div>
  );
}
