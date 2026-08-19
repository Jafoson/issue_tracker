import type { ReactNode } from "react";
import styles from "./settingsIdentity.module.scss";

interface Props {
  /** Der Avatar/das Symbol samt Ändern-Knopf, zentriert über den Feldern. */
  avatar: ReactNode;
  /** Die Felder darunter, einspaltig gestapelt — je Feld typischerweise ein
   *  `Input` mit eigenem `label`, oder ein `.field`-Wrapper für Bedienelemente
   *  ohne eigene Beschriftung (z. B. `ColorPicker`). */
  children: ReactNode;
}

/**
 * Der Kopf einer Einstellungsseite als Formular statt als Zeilen-Tabelle:
 * Symbol mittig oben, Felder einspaltig darunter, jedes mit seiner
 * Beschriftung direkt darüber statt einer Erklärung daneben.
 *
 * Für die Stammdaten von Workspace, Projekt und Konto — dort, wo eine Person
 * zuerst hinsieht, bevor sie zu den listenartigen Bereichen darunter (Links,
 * Sichtbarkeit, Gefahrenzone, ...) weitergeht. Diese bleiben bei der
 * Zeilen-Tabelle (`Table`/`SettingsList`): hier geht es um „wer/was ist das",
 * dort um „was gilt dafür".
 */
export function SettingsIdentity({ avatar, children }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.avatarArea}>{avatar}</div>
      <div className={styles.fields}>{children}</div>
    </div>
  );
}
