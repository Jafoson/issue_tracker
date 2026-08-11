import { NavLink } from "@/components/ui/layout/NavLink/NavLink";
import {
  type SettingsNavSubject,
  SettingsSubjectMenu,
} from "./SettingsSubjectMenu";
import styles from "./settingsNav.module.scss";

export type { SettingsNavSubject };

export interface SettingsNavItem {
  href: string;
  label: string;
  icon: string;
}

interface Props {
  /** Wessen Einstellungen — Name des Workspace oder des Projekts. */
  subject: string;
  /** Farbpunkt vor dem Namen. Ohne ihn steht der Name allein. */
  color?: string;
  /**
   * Macht den Kopf zum Wechsler: Geschwister, zu deren gleichem Bereich man von
   * hier springen kann. Bei weniger als zwei Einträgen bleibt der Name stehen —
   * ein Auslöser ohne Ziel wäre ein Versprechen, das die Liste nicht hält.
   */
  siblings?: SettingsNavSubject[];
  /** Überschrift über der Wechselliste, z. B. „Projekt". */
  siblingsLabel?: string;
  /** Überschrift der Leiste, z. B. „Einstellungen". */
  title: string;
  /**
   * Bereits gefiltert: das Layout entfernt, wofür das Recht fehlt. Diese
   * Komponente prüft nichts — sie zeichnet, was sie bekommt.
   */
  items: SettingsNavItem[];
}

/**
 * Die zweite Navigationsebene der Einstellungen — für den Workspace, für ein
 * Projekt und für das eigene Konto.
 *
 * Zwischen diesen dreien wechselt man eine Ebene höher, in der Kopfzeile
 * darüber (`components/ui/layout/SettingsHeader`) — der Umschalter tauscht auch
 * diese Leiste aus und kann deshalb nicht in ihr stehen.
 *
 * Sie sitzt neben der Seitenleiste, nicht in ihr: Allgemein, Mitglieder, Rollen
 * und Labels gehören zusammen und würden die Liste daneben sonst um eine
 * Handvoll Zeilen je Eintrag aufblähen.
 *
 * Die Zeilen sind dieselben wie in der Seitenleiste (`NavLink`) — zwei Ebenen
 * derselben Navigation sollen sich nicht unterschiedlich anfühlen, und die
 * Markierung folgt damit auch derselben Regel (`isNavActive`, ohne Muster also
 * der ganze Pfad und nicht sein Anfang). Dadurch bleibt diese Komponente eine
 * Server Component: den Pfad liest die Zeile selbst.
 */
export function SettingsNav({
  subject,
  color,
  siblings,
  siblingsLabel,
  title,
  items,
}: Props) {
  // Der Kopf wird nur zum Wechsler, wenn es etwas zu wechseln gibt: das eigene
  // Konto hat keine Geschwister, und ein einzelnes Projekt ist keine Auswahl.
  const switchable =
    siblingsLabel && color && siblings && siblings.length > 1 ? siblings : null;

  return (
    <nav className={styles.nav} aria-label={title}>
      {switchable && color && siblingsLabel ? (
        <SettingsSubjectMenu
          name={subject}
          color={color}
          siblings={switchable}
          label={siblingsLabel}
        />
      ) : (
        <div className={styles.head}>
          {color && (
            <span
              className={styles.dot}
              style={{ background: color }}
              aria-hidden
            />
          )}
          <span className={styles.subject} title={subject}>
            {subject}
          </span>
        </div>
      )}
      <p className={styles.title}>{title}</p>

      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.href}>
            <NavLink href={item.href} icon={item.icon} label={item.label} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
