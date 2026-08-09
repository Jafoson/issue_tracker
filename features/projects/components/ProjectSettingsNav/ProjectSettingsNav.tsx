"use client";

import { Icon } from "@iconify/react";
import { Link, usePathname } from "@/i18n/navigation";
import styles from "./projectSettingsNav.module.scss";

export interface ProjectSettingsNavItem {
  href: string;
  label: string;
  icon: string;
}

interface Props {
  projectName: string;
  projectColor: string;
  /** Überschrift der Leiste, z. B. „Einstellungen". */
  title: string;
  /**
   * Bereits gefiltert: das Layout entfernt, wofür das Recht fehlt. Diese
   * Komponente prüft nichts — sie zeichnet, was sie bekommt.
   */
  items: ProjectSettingsNavItem[];
}

/**
 * Die zweite Navigationsebene der Projekteinstellungen.
 *
 * Sie sitzt neben der Seitenleiste, nicht in ihr: Allgemein, Mitglieder, Rollen
 * und Labels gehören zusammen und würden die Projektliste sonst um vier Zeilen
 * je Projekt aufblähen. Aktiv ist genau ein Eintrag — jeder Bereich ist eine
 * eigene Route, verglichen wird deshalb der ganze Pfad und nicht sein Anfang.
 */
export function ProjectSettingsNav({
  projectName,
  projectColor,
  title,
  items,
}: Props) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label={title}>
      <div className={styles.head}>
        <span
          className={styles.dot}
          style={{ background: projectColor }}
          aria-hidden
        />
        <span className={styles.project} title={projectName}>
          {projectName}
        </span>
      </div>
      <p className={styles.title}>{title}</p>

      <ul className={styles.list}>
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={styles.link}
                data-active={active ? "true" : undefined}
                aria-current={active ? "page" : undefined}
              >
                <Icon icon={item.icon} width={16} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
