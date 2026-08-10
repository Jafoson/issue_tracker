/**
 * Das Datenmodell der Tabelle — ohne Hooks, ohne `"use client"`.
 *
 * `Table` rendert server- wie clientseitig, `useTableDnd` läuft nur im Browser.
 * Beide lesen dieselben Typen, dürfen sich aber nicht gegenseitig importieren:
 * ein Wert aus einem Client-Modul wäre im Server-Render nur eine Referenz, kein
 * String. Deshalb liegt das Gemeinsame hier.
 */

import type { ReactNode } from "react";

export type TableAlign = "start" | "center" | "end";

export interface TableColumn<T> {
  /** Stabile Spalten-ID — dient zugleich als React-Key der Zellen. */
  id: string;
  /**
   * Titel in der Kopfzeile. Definiert keine Spalte einen, entfällt die
   * Kopfzeile komplett — Listenansichten kommen oft ohne aus.
   */
  header?: ReactNode;
  /**
   * Grid-Track der Spalte: `"auto"`, `"max-content"`, `"minmax(0, 1fr)"`,
   * `"88px"` … Inhaltsbasierte Werte messen über *alle* Zeilen hinweg, weil die
   * Zeilen `subgrid` sind. Genau eine Spalte sollte `minmax(0, 1fr)` bekommen —
   * sie schluckt den Rest und kürzt ihren Inhalt.
   */
  width?: string;
  align?: TableAlign;
  cell: (row: T) => ReactNode;
  /**
   * Macht die Spalte sortierbar — und zwar über den Wert, nicht über die Zelle:
   * gerendert wird dort ein Avatar, ein Label oder eine Plakette, und keines
   * davon lässt sich vergleichen.
   *
   * Erst zusammen mit `useTableSort` entsteht daraus ein Kopf zum Anklicken.
   * Eine Spalte ohne diese Funktion bleibt eine Überschrift — was sich nicht
   * sinnvoll ordnen lässt (Aktionen, Avatare, freie Textwolken), soll auch
   * nicht so aussehen.
   */
  sortValue?: (row: T) => TableSortValue;
}

/**
 * Woran sortiert wird. `Date` und Zahlen vergleicht die Größe, Strings die
 * Sprache des Browsers; leer (`null`, `undefined`, `""`) landet immer unten —
 * in beiden Richtungen, denn "nichts" ist kein kleiner Wert, sondern ein
 * fehlender.
 */
export type TableSortValue = string | number | Date | null | undefined;

export type TableSortDirection = "asc" | "desc";

export interface TableGroup<T> {
  id: string;
  /** Sichtbarer Gruppenkopf — bleibt beim Scrollen oben stehen. */
  header?: ReactNode;
  /** Name der Gruppe für Screenreader, wenn `header` vor allem Grafik ist. */
  label?: string;
  /**
   * Blendet die Zeilen aus, der Kopf bleibt stehen. Den Zustand hält der
   * Aufrufer — er rendert den Kopf und damit auch dessen Umschalter.
   */
  collapsed?: boolean;
  rows: T[];
}

/**
 * Gruppen-ID der flachen Tabelle. Eine Tabelle ohne `groups` ist intern die
 * Gruppe "alle Zeilen" — beim Sortieren per Drag & Drop taucht diese ID als
 * Ziel wieder auf.
 */
export const FLAT_GROUP_ID = "rows";
