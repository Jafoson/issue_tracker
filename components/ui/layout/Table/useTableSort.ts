"use client";

import { useState } from "react";
import type { TableColumn, TableSortDirection, TableSortValue } from "./types";

/** Was `<Table sort={…}>` erwartet. Erzeugt wird es allein von `useTableSort`. */
export interface TableSort {
  /** Spalte, nach der gerade geordnet ist — `null`, solange keine gewählt ist. */
  columnId: string | null;
  direction: TableSortDirection;
  /** Schaltet den Kopf weiter: aufwärts → abwärts → wieder Grundordnung. */
  toggle: (columnId: string) => void;
}

export interface TableSortOptions {
  /**
   * Spalte, nach der die Tabelle von Anfang an ordnet. Ohne Angabe bleibt die
   * Reihenfolge, in der die Zeilen hereinkommen — die ist meist schon die
   * sinnvolle (die Abfrage hat sortiert), und ein Server, der anders ordnet als
   * der Browser gleich danach, führt zu einem Sprung beim ersten Rendern.
   */
  columnId?: string;
  direction?: TableSortDirection;
}

/** Der Zustand ohne den Umschalter — das, was ein Klick verändert. */
export interface TableSortState {
  columnId: string | null;
  direction: TableSortDirection;
}

/**
 * Was ein Klick auf einen Spaltenkopf aus dem bisherigen Zustand macht.
 *
 * Drei Stufen, nicht zwei: der dritte Klick stellt die Grundordnung wieder her.
 * Sie ist selbst eine Aussage — die Abfrage hat sie gewählt — und ohne Rückweg
 * käme man nie wieder an sie heran.
 *
 * Steht außerhalb des Hooks, weil sie nichts von React braucht: eine Ansicht,
 * die ihre Sortierung anderswo hält, kommt an dieselbe Regel.
 */
export function nextSortState(
  current: TableSortState,
  columnId: string,
): TableSortState {
  if (current.columnId !== columnId) return { columnId, direction: "asc" };
  if (current.direction === "asc") return { columnId, direction: "desc" };
  return { columnId: null, direction: "asc" };
}

const isEmpty = (value: TableSortValue) =>
  value === null || value === undefined || value === "";

/**
 * Vergleicht zwei Zellwerte. Zahlen und Daten der Größe nach, alles andere als
 * Text — mit `numeric`, damit „Sprint 2" vor „Sprint 10" steht, und ohne
 * Rücksicht auf Groß- und Kleinschreibung.
 */
function compare(a: TableSortValue, b: TableSortValue): number {
  if (typeof a === "number" || a instanceof Date) return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Sortierung für eine Tabelle mit Kopfzeile.
 *
 * Der Zustand ist absichtlich klein und lokal: eine Spalte und eine Richtung,
 * gehalten von der Ansicht, die die Tabelle rendert. Nichts davon gehört in die
 * URL — eine Sortierung ist ein Blick auf eine Liste, kein Ort, den man teilt
 * oder wiederfindet.
 *
 * ```tsx
 * const { sort, sortRows } = useTableSort(columns);
 * <Table columns={columns} rows={sortRows(rows)} sort={sort} … />
 * ```
 *
 * `sortRows` ist bewusst eine Funktion und kein zweiter Rückgabewert: eine
 * Tabelle mit Bändern ruft sie je Band auf und behält damit ihre Gruppierung —
 * sortiert wird innerhalb einer Gruppe, nicht über sie hinweg.
 */
export function useTableSort<T>(
  columns: TableColumn<T>[],
  options: TableSortOptions = {},
) {
  const [state, setState] = useState<TableSortState>({
    columnId: options.columnId ?? null,
    direction: options.direction ?? "asc",
  });

  const toggle = (columnId: string) =>
    setState((current) => nextSortState(current, columnId));

  const active = columns.find(
    (column) => column.id === state.columnId && column.sortValue,
  );

  const sortRows = (rows: T[]): T[] => {
    const sortValue = active?.sortValue;
    if (!sortValue) return rows;

    // Kopie: `sort` arbeitet an Ort und Stelle, und die Zeilen gehören dem
    // Aufrufer. Der Vergleich ist stabil, gleiche Werte behalten also die
    // Grundordnung — zwei Projekte mit je drei Aufgaben stehen weiter
    // alphabetisch.
    return [...rows].sort((a, b) => {
      const left = sortValue(a);
      const right = sortValue(b);
      if (isEmpty(left) || isEmpty(right))
        return isEmpty(left) && isEmpty(right) ? 0 : isEmpty(left) ? 1 : -1;
      const order = compare(left, right);
      return state.direction === "asc" ? order : -order;
    });
  };

  const sort: TableSort = {
    columnId: active ? state.columnId : null,
    direction: state.direction,
    toggle,
  };

  return { sort, sortRows };
}
