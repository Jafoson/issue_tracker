import type { ReactNode } from "react";
import {
  Avatar,
  type AvatarData,
  type AvatarShape,
} from "@/components/ui/atoms/Avatar/Avatar";
import styles from "./userCell.module.scss";

interface UserCellProps {
  avatar: AvatarData | null;
  /** First line — the name of the person or entity. */
  name: ReactNode;
  /**
   * Second line: email, handle, role, ... Without it, the name sits alone
   * next to the avatar instead of above an empty line.
   */
  meta?: ReactNode;
  /** Sits directly after the name, e.g. a badge ("Invited"). */
  trailing?: ReactNode;
  size?: number;
  shape?: AvatarShape;
  /** Show a placeholder instead of a gap when there's no `avatar`. */
  placeholder?: boolean;
  placeholderLabel?: string;
  className?: string;
}

/**
 * Avatar plus identity in two lines — the consistent way to show a person in
 * a list (member tables, selection lists, assignments). Both text lines
 * truncate with an ellipsis so the column isn't stretched apart by a long email.
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
