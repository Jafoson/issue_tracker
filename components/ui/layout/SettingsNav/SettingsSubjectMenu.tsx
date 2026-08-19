"use client";

import { Icon } from "@iconify/react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Popover } from "@/components/ui/atoms/Popover/Popover";
import { NavLink } from "@/components/ui/layout/NavLink/NavLink";
import styles from "./settingsNav.module.scss";

export interface SettingsNavSubject {
  id: string;
  name: string;
  color: string;
  /** Hochgeladenes Bild statt des Farbpunkts, z. B. ein Workspace-Avatar. */
  image?: string;
  /** Der gleiche Bereich beim Geschwister — in der Regel dessen Allgemein-Seite. */
  href: string;
  /**
   * Überschrift, unter der die Zeile steht — für Projekte der Workspace, in dem
   * sie liegen. Ohne Angabe steht die Liste ungegliedert da. Gruppiert wird nach
   * Reihenfolge, nicht nach Sammeln: die Liste kommt sortiert herein.
   */
  group?: string;
}

interface Props {
  /** Wessen Einstellungen gerade offen sind — nur fürs Auge des Auslösers. */
  name: string;
  color: string;
  /** Hochgeladenes Bild statt des Farbpunkts im Auslöser. */
  image?: string;
  /**
   * Wohin man von hier springen kann, das offene Element eingeschlossen.
   * Bereits gefiltert: das Layout gibt nur weiter, was der Benutzer sehen darf.
   */
  siblings: SettingsNavSubject[];
  /** Überschrift über der Liste, z. B. „Projekt". */
  label: string;
}

/**
 * Der Kopf der Einstellungsleiste als Wechsler — dasselbe wie der Workspace-
 * Wechsler in der Seitenleiste, nur eine Ebene tiefer und mit dem Ziel, im
 * gleichen Bereich zu bleiben.
 *
 * Wer die Einstellungen eines Projekts offen hat, will von dort meist zu denen
 * eines anderen und nicht auf dessen Board; der Weg über Seitenleiste, Projekt,
 * Einstellungen sind drei Klicks für einen Wechsel. Deshalb führen die Zeilen
 * hier auf `…/settings` und nicht auf die Startseite des Geschwisters.
 *
 * Die Zeilen sind `NavLink`s wie überall sonst in der Navigation: echte Links
 * (Mittelklick, neuer Reiter) und dieselbe Markierung des offenen Eintrags nach
 * derselben Regel. Der Auslöser ist ein Knopf, weil er nirgendwohin führt — er
 * klappt nur auf.
 */
export function SettingsSubjectMenu({
  name,
  color,
  image,
  siblings,
  label,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <div ref={ref} className={styles.switcher}>
      <Button
        variant="ghost"
        full
        textAlign="left"
        className={styles.trigger}
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {image ? (
          <img src={image} alt="" className={styles.dotImg} />
        ) : (
          <span
            className={styles.dot}
            style={{ background: color }}
            aria-hidden
          />
        )}
        <span className={styles.subject} title={name}>
          {name}
        </span>
        <Icon
          icon="lucide:chevrons-up-down"
          width={14}
          className={styles.chevron}
        />
      </Button>

      <Popover
        anchorRef={ref}
        open={open}
        onClose={() => setOpen(false)}
        width={228}
      >
        {/* Reicht die Auswahl über Workspaces hinweg, wird sie lang. Der
            `Popover` kennt keine Höhe — er verschiebt sich nur, damit er ins
            Bild passt. Also begrenzt die Liste sich hier selbst. */}
        <div className={styles.menuList}>
          {siblings.map((item, i) => {
            // Die Überschrift steht, wo die Gruppe wechselt. Ohne Gruppen bleibt
            // es bei der einen ganz oben, die sagt, wovon dies die Auswahl ist.
            const heading =
              item.group && item.group !== siblings[i - 1]?.group
                ? item.group
                : i === 0
                  ? label
                  : null;

            return (
              <div key={item.id}>
                {heading && <p className={styles.menuLabel}>{heading}</p>}
                <NavLink
                  href={item.href}
                  label={item.name}
                  color={item.color}
                  image={item.image}
                  onClick={() => setOpen(false)}
                />
              </div>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}
