import { Icon } from "@iconify/react";
import { Link } from "@/i18n/navigation";
import type { SettingsScopeEntry, SettingsScopeKey } from "@/lib/nav";
import styles from "./settingsHeader.module.scss";

interface Props {
  /** Fertig gebaut vom Layout — `settingsScopeItems` in `lib/nav.ts`. */
  items: SettingsScopeEntry[];
  /** Der Bereich, in dem man gerade steht. */
  active: SettingsScopeKey;
  /** Benennt den Umschalter für Screenreader, z. B. „Einstellungsbereich". */
  label: string;
  /** Steht an einem Bereich ohne Ziel — sagt, warum er nicht öffnet. */
  unavailableHint?: string;
}

/**
 * Die oberste Zeile der Einstellungen: der Umschalter zwischen Persönlich,
 * Projekt und Workspace.
 *
 * Sie liegt quer über beiden Spalten darunter — über der Bereichsleiste und
 * über dem Bereich selbst. Das ist keine Kosmetik, sondern die Rangfolge: der
 * Umschalter wechselt beide Spalten auf einmal, also darf er in keiner von
 * beiden stehen. In der Leiste (208px) blieb außerdem für „Persönlich" kein
 * ganzes Wort übrig; hier ist Platz für Zeichen und Beschriftung.
 *
 * Die Zeile setzt selbst keine Kante nach unten. Der Strich darunter entsteht
 * aus den Oberkanten der beiden Spalten (`SettingsNav`, `PageHeader`) — er läuft
 * damit über die ganze Breite und bleibt einer statt zwei.
 *
 * Bewusst aus Links statt aus Knöpfen: jeder Bereich hat eine eigene Adresse,
 * und ein Link lässt sich in einem neuen Reiter öffnen. Dadurch braucht die
 * Zeile kein `"use client"` — welcher Bereich gilt, weiß das Layout, das sie
 * rendert, und nicht der Browser.
 */
export function SettingsHeader({
  items,
  active,
  label,
  unavailableHint,
}: Props) {
  return (
    <header className={styles.bar}>
      <nav className={styles.scope} aria-label={label}>
        {items.map((item) => {
          const content = (
            <>
              <Icon className={styles.icon} icon={item.icon} width={15} />
              {item.label}
            </>
          );

          // Ohne Ziel bleibt der Platz stehen: der Umschalter behält seine drei
          // Felder, und wer kein Projekt sieht, sieht wenigstens, dass es
          // diesen Bereich gibt.
          if (!item.href) {
            return (
              <span
                key={item.key}
                className={`${styles.segment} ${styles.dead}`}
                title={unavailableHint}
                aria-disabled="true"
              >
                {content}
              </span>
            );
          }

          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={styles.segment}
              data-active={isActive || undefined}
              aria-current={isActive ? "page" : undefined}
            >
              {content}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
