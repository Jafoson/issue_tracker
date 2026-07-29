import type { ReactNode } from "react";
import {
  Avatar,
  type AvatarData,
  type AvatarShape,
} from "@/components/ui/atoms/Avatar/Avatar";
import styles from "./userCell.module.scss";

interface UserCellProps {
  avatar: AvatarData | null;
  /** Erste Zeile — der Name der Person bzw. Entität. */
  name: ReactNode;
  /**
   * Zweite Zeile: E-Mail, Handle, Rolle … Ohne sie steht der Name allein neben
   * dem Avatar statt oberhalb einer leeren Zeile.
   */
  meta?: ReactNode;
  /** Steht direkt hinter dem Namen, z. B. ein Badge („Eingeladen"). */
  trailing?: ReactNode;
  size?: number;
  shape?: AvatarShape;
  /** Ohne `avatar` einen Platzhalter statt einer Lücke zeigen. */
  placeholder?: boolean;
  placeholderLabel?: string;
  className?: string;
}

/**
 * Avatar plus Identität in zwei Zeilen — der immer gleiche Weg, eine Person in
 * einer Liste zu zeigen (Mitglieder-Tabellen, Auswahl-Listen, Zuweisungen).
 * Beide Textzeilen kürzen mit Ellipse, damit die Spalte nicht von einer langen
 * E-Mail auseinandergedrückt wird.
 */
export function UserCell({
  avatar,
  name,
  meta,
  trailing,
  size = 30,
  shape,
  placeholder,
  placeholderLabel,
  className,
}: UserCellProps) {
  return (
    <span className={[styles.cell, className].filter(Boolean).join(" ")}>
      <Avatar
        avatar={avatar}
        size={size}
        shape={shape}
        placeholder={placeholder}
        placeholderLabel={placeholderLabel}
      />
      <span className={styles.text}>
        <span className={styles.name}>
          <span className={styles.truncate}>{name}</span>
          {trailing}
        </span>
        {meta && <span className={styles.meta}>{meta}</span>}
      </span>
    </span>
  );
}
