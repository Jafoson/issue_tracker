"use client";

import { useState } from "react";
import type { TableColumn, TableSortDirection, TableSortValue } from "./types";

/** What `<Table sort={…}>` expects. Only ever produced by `useTableSort`. */
export interface TableSort {
  /** Column currently sorted by — `null` as long as none is chosen. */
  columnId: string | null;
  direction: TableSortDirection;
  /** Advances the header: ascending → descending → back to the base order. */
  toggle: (columnId: string) => void;
}

export interface TableSortOptions {
  /**
   * Column the table sorts by from the start. Without one, the order the
   * rows arrive in is kept — that's usually already the sensible one (the
   * query has sorted), and a server ordering differently from what the
   * browser does right after leads to a jump on the first render.
   */
  columnId?: string;
  direction?: TableSortDirection;
}

/** The state without the toggle — what a click changes. */
export interface TableSortState {
  columnId: string | null;
  direction: TableSortDirection;
}

/**
 * What a click on a column header makes of the previous state.
 *
 * Three stages, not two: the third click restores the base order. It's a
 * statement in its own right — the query chose it — and without a way back
 * you could never reach it again.
 *
 * Lives outside the hook because it needs nothing from React: a view that
 * holds its sorting elsewhere gets the same rule.
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
 * Compares two cell values. Numbers and dates by magnitude, everything else
 * as text — with `numeric`, so "Sprint 2" sits before "Sprint 10", and
 * case-insensitively.
 */
function compare(a: TableSortValue, b: TableSortValue): number {
  if (typeof a === "number" || a instanceof Date) return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Sorting for a table with a header row.
 *
 * The state is deliberately small and local: one column and one direction,
 * held by the view that renders the table. None of it belongs in the URL —
 * a sort is a way of looking at a list, not a place you share or return to.
 *
 * ```tsx
 * const { sort, sortRows } = useTableSort(columns);
 * <Table columns={columns} rows={sortRows(rows)} sort={sort} … />
 * ```
 *
 * `sortRows` is deliberately a function and not a second return value: a
 * table with bands calls it per band and thereby keeps its grouping —
 * sorting happens within a group, not across them.
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

    // Copy: `sort` operates in place, and the rows belong to the caller.
    // The comparison is stable, so equal values keep the base order — two
    // projects with three issues each stay alphabetical relative to each
    // other.
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
