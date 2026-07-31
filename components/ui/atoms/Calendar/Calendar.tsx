"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import { toIso } from "@/lib/richtext/date";
import styles from "./calendar.module.scss";

/**
 * Ein Monatsblatt zum Auswählen eines Tages.
 *
 * Bewusst klein gehalten: keine Bereiche, keine Uhrzeit, keine Sperrtage — ein
 * Datum im Fließtext braucht davon nichts. Wer mehr will, tippt es direkt.
 *
 * Monats- und Wochentagsnamen kommen aus `Intl` und richten sich damit nach der
 * Umgebung; die Komponente läuft nur im Browser, eine Abweichung zum Server
 * kann es also nicht geben.
 */

/** Montag zuerst — die hier übliche Woche. */
const FIRST_DAY = 1;

interface CalendarProps {
  /** Vorbelegung als ISO-Datum. */
  value?: string;
  onPick: (iso: string) => void;
  /** Beschriftungen der Schnellwahl; ohne sie entfällt die Zeile. */
  todayLabel?: string;
  tomorrowLabel?: string;
}

/** Der Monat, auf dem das Blatt aufschlägt. */
function initialMonth(value: string | undefined): Date {
  const parsed = value ? new Date(`${value}T12:00:00`) : null;
  const base = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  return new Date(base.getFullYear(), base.getMonth(), 1);
}

/**
 * Die Tage, die das Blatt zeigt: der Monat selbst, davor die Reste der ersten
 * Woche und dahinter die der letzten. So bleibt das Raster immer rechteckig.
 */
function weeksOf(month: Date): Date[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  // Wie viele Tage der Vormonat in die erste Zeile hineinragt.
  const lead = (first.getDay() - FIRST_DAY + 7) % 7;

  const start = new Date(first);
  start.setDate(first.getDate() - lead);

  const weeks: Date[][] = [];
  const cursor = new Date(start);

  // Sechs Zeilen: dann springt das Blatt beim Monatswechsel nicht in der Höhe.
  for (let week = 0; week < 6; week++) {
    const days: Date[] = [];
    for (let day = 0; day < 7; day++) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }
  return weeks;
}

const isoOf = (d: Date) =>
  toIso(d.getFullYear(), d.getMonth() + 1, d.getDate());

export function Calendar({
  value,
  onPick,
  todayLabel,
  tomorrowLabel,
}: CalendarProps) {
  const [month, setMonth] = useState(() => initialMonth(value));

  const today = isoOf(new Date());
  const weeks = weeksOf(month);

  const shift = (by: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));

  const monthName = month.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  // Namen der Wochentage aus einer beliebigen Woche ableiten, damit sie in
  // derselben Sprache stehen wie der Monat darüber.
  const weekdays = weeks[0].map((d) =>
    d.toLocaleDateString(undefined, { weekday: "short" }),
  );

  const quick = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    onPick(isoOf(d));
  };

  return (
    <div className={styles.calendar}>
      <div className={styles.head}>
        <button
          type="button"
          className={styles.nav}
          aria-label="←"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => shift(-1)}
        >
          <Icon icon="lucide:chevron-left" width={15} />
        </button>
        <span className={styles.month}>{monthName}</span>
        <button
          type="button"
          className={styles.nav}
          aria-label="→"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => shift(1)}
        >
          <Icon icon="lucide:chevron-right" width={15} />
        </button>
      </div>

      {/* Kein `role="grid"`: dafür bräuchte es Zeilen- und Zellenrollen, und
          das Raster ist ein flaches CSS-Grid. Statt vorgetäuschter Struktur
          trägt jeder Tag sein vollständiges Datum als Beschriftung. */}
      <div className={styles.grid}>
        {weekdays.map((name) => (
          <span key={name} className={styles.weekday}>
            {name}
          </span>
        ))}

        {weeks.flat().map((day) => {
          const iso = isoOf(day);
          return (
            <button
              key={iso}
              type="button"
              className={styles.day}
              // Tage der Nachbarmonate bleiben wählbar, treten aber zurück.
              data-outside={day.getMonth() !== month.getMonth() || undefined}
              data-today={iso === today || undefined}
              data-selected={iso === value || undefined}
              // Der Fokus muss im Editor bleiben, sonst bricht die Auswahl weg.
              aria-label={day.toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              aria-current={iso === today ? "date" : undefined}
              aria-pressed={iso === value || undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(iso)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      {(todayLabel || tomorrowLabel) && (
        <div className={styles.quick}>
          {todayLabel && (
            <button
              type="button"
              className={styles.quickBtn}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => quick(0)}
            >
              {todayLabel}
            </button>
          )}
          {tomorrowLabel && (
            <button
              type="button"
              className={styles.quickBtn}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => quick(1)}
            >
              {tomorrowLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
