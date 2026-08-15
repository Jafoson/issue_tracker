import type { Issue } from "@/types";

/**
 * Die Reihenfolge von Issues — dieselbe Rechnung für Board und Liste.
 *
 * Der Rang ist eine Fließkommazahl, keine Position: zwischen zwei Nachbarn
 * passt immer noch eine Zahl. Ein Umsortieren schreibt deshalb genau eine
 * Zeile, nicht die ganze Spalte.
 */

/** `rank = 0` heißt "noch nie einsortiert" — dann zählt der Anlagezeitpunkt. */
export const effectiveRank = (issue: Issue) =>
  issue.rank !== 0 ? issue.rank : issue.created;

export const sortByRank = <T extends Issue>(issues: T[]): T[] =>
  [...issues].sort((a, b) => effectiveRank(a) - effectiveRank(b));

/**
 * Der Rang für einen Platz zwischen zwei Nachbarn. Fehlt einer, geht es um den
 * Anfang bzw. das Ende der Liste; fehlen beide, ist die Liste leer und der
 * Zeitstempel gibt einen Rang, der zu den übrigen passt.
 */
export const rankBetween = (previous: Issue | null, next: Issue | null) => {
  if (previous && next)
    return (effectiveRank(previous) + effectiveRank(next)) / 2;
  if (previous) return effectiveRank(previous) + 1000;
  if (next) return effectiveRank(next) - 1000;
  return Date.now();
};
