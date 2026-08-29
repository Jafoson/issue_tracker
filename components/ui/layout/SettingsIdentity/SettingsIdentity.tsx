import type { ReactNode } from "react";
import styles from "./settingsIdentity.module.scss";

interface Props {
  /** The avatar/icon along with the change button, centered above the fields. */
  avatar: ReactNode;
  /** The fields below, stacked in a single column — typically an `Input`
   *  with its own `label` per field, or a `.field` wrapper for controls
   *  without their own label (e.g. `ColorPicker`). */
  children: ReactNode;
}

/**
 * The header of a settings page as a form rather than a row table: icon
 * centered on top, fields stacked in a single column below, each with its
 * label directly above it rather than an explanation beside it.
 *
 * For the core data of workspace, project, and account — where a person
 * looks first before moving on to the list-like sections below (links,
 * visibility, danger zone, ...). Those stay with the row table
 * (`Table`/`SettingsList`): this is about "who/what is this", those are
 * about "what applies to it".
 */
export function SettingsIdentity({ avatar, children }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.avatarArea}>{avatar}</div>
      <div className={styles.fields}>{children}</div>
    </div>
  );
}
