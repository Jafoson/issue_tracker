"use client";

import { useFormatter, useTranslations } from "next-intl";

/**
 * Lokalisierte, relative Zeitangabe für Karten- und Listenansichten.
 *
 * Bewusst kompakt gehalten ("3d ago" / "vor 3 T."), damit die Angabe in engen
 * Spalten nicht umbricht. Die Abkürzungen sind numerusinvariant, deshalb reicht
 * einfache Interpolation statt ICU-Plural. Alles ab fünf Wochen wird als
 * absolutes Datum in der aktiven Locale formatiert.
 *
 * Gibt eine Formatierfunktion zurück, damit eine Komponente mehrere Zeitstempel
 * mit nur einem Hook-Aufruf rendern kann.
 */
export function useTimeAgo() {
  const t = useTranslations("time");
  const format = useFormatter();

  return (ts: number) => {
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return t("justNow");

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t("minutes", { count: minutes });

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("hours", { count: hours });

    const days = Math.floor(hours / 24);
    if (days < 7) return t("days", { count: days });

    const weeks = Math.floor(days / 7);
    if (weeks < 5) return t("weeks", { count: weeks });

    return format.dateTime(ts, { month: "short", day: "numeric" });
  };
}
