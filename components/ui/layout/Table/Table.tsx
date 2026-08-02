import {
  type CSSProperties,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import styles from "./table.module.scss";
import { FLAT_GROUP_ID, type TableColumn, type TableGroup } from "./types";
import type { TableDnd } from "./useTableDnd";

export type { TableAlign, TableColumn, TableGroup } from "./types";

interface TableBaseProps<T> {
  columns: TableColumn<T>[];
  getRowKey: (row: T) => string;
  /**
   * Element, das die gesamte Zeile überdeckt und sie bedienbar macht — in der
   * Regel ein `<Link>`. Bewusst kein `onRowClick`: ein Link bringt Fokus,
   * Tastatur, Mittelklick und "in neuem Tab öffnen" von Haus aus mit.
   * Interaktive Zellinhalte (Buttons, Links, Inputs) liegen automatisch darüber.
   */
  rowOverlay?: (row: T) => ReactNode;
  /** Hebt eine Zeile dauerhaft hervor, z. B. das gerade geöffnete Objekt. */
  isRowActive?: (row: T) => boolean;
  /** Name der Tabelle für Screenreader. */
  label?: string;
  /** Ersatzinhalt, wenn keine einzige Zeile vorhanden ist. */
  empty?: ReactNode;
  /** Füllt den verfügbaren Platz eines Flex-Containers und scrollt selbst. */
  fill?: boolean;
  /**
   * `"card"` fasst die Tabelle in eine umrandete Fläche mit Trennlinien
   * zwischen den Zeilen — für Verwaltungslisten, die als abgeschlossener Block
   * auf einer Seite stehen. `"plain"` (Vorgabe) lässt die Zeilen frei im Raum
   * stehen und trennt sie nur über Rhythmus und Hover; das passt, wenn die
   * Tabelle die ganze Ansicht ist.
   */
  variant?: "plain" | "card";
  /**
   * Macht die Zeilen sortierbar — das Ergebnis von `useTableDnd`. Ohne diese
   * Prop bleibt die Tabelle, was sie ist: eine Ansicht ohne Zustand, die auch
   * eine Server Component rendern kann.
   */
  dnd?: TableDnd<T>;
  className?: string;
}

/**
 * Zeilen kommen entweder flach (`rows`) oder in Gruppen mit eigenem Kopf
 * (`groups`) — beides gleichzeitig ergäbe zwei Wahrheiten über dieselbe Tabelle.
 */
export type TableProps<T> = TableBaseProps<T> &
  ({ rows: T[]; groups?: never } | { groups: TableGroup<T>[]; rows?: never });

const DEFAULT_WIDTH = "auto";

/** Sechs Punkte — das gewohnte Zeichen für "hier anfassen". */
const GRIP_DOTS = [
  [3, 4],
  [7, 4],
  [3, 8],
  [7, 8],
  [3, 12],
  [7, 12],
];

/**
 * Tabelle mit einem einzigen Grid-Raster: `<tr>` greift die Spalten der
 * `<table>` per `subgrid` wieder ab. Dadurch stehen die Spalten aller Gruppen
 * exakt untereinander, auch wenn ihre Breite aus dem Inhalt kommt — und die
 * Zeile bleibt ein echter Kasten, der Sticky-Gruppenköpfe, Hover und einen
 * zeilenfüllenden Link trägt, woran das native Tabellenlayout scheitert.
 *
 * Das Aussehen sitzt in `table.module.scss`. Drei Werte darf der Aufrufer
 * verstellen — als vererbte Custom Properties auf seinem Wrapper, nicht als
 * Prop, weil sie reine Optik sind:
 *
 * ```scss
 * .wrapper {
 *   --table-row-height: 52px;              // Höhe der Zeilen
 *   --table-surface: var(--surface);       // Grundfläche der Karte
 *   --table-divider: var(--outline-variant); // Linie zwischen den Zeilen
 * }
 * ```
 *
 * Vorgabe ist die einzeilige Liste: Zeilenhöhe `--row-h`, Seitengrund, keine
 * Trennlinien. Wer sie ändert, muss die Dichte nachziehen
 * (`[data-density="compact"] .wrapper`) — der eigene Wert sticht sie aus.
 */
export function Table<T>({
  columns,
  getRowKey,
  rowOverlay,
  isRowActive,
  label,
  empty,
  fill,
  variant = "plain",
  dnd,
  className,
  rows,
  groups,
}: TableProps<T>) {
  // Flache Zeilen sind der Sonderfall "eine Gruppe ohne Kopf".
  const sections: TableGroup<T>[] = groups ?? [
    { id: FLAT_GROUP_ID, rows: rows ?? [] },
  ];
  const showHead = columns.some((column) => column.header !== undefined);
  const isEmpty = sections.every((section) => section.rows.length === 0);

  const cellClass = (column: TableColumn<T>) =>
    [styles.cell, column.align && styles[column.align]]
      .filter(Boolean)
      .join(" ");

  const root = [
    styles.table,
    fill && styles.fill,
    variant === "card" && styles.card,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Die Spaltenbreiten sind Daten, kein Aussehen — deshalb als Custom Property
  // ins Stylesheet gereicht statt als Klasse pro Layout.
  const trackStyle = {
    "--table-cols": columns
      .map((column) => column.width ?? DEFAULT_WIDTH)
      .join(" "),
  } as CSSProperties;

  // Ein Anker ist von Haus aus ziehbar: ohne das Verbot nähme der Browser beim
  // Ziehen die Verknüpfung mit statt die Zeile darunter.
  const overlayOf = (row: T) => {
    const node = rowOverlay?.(row);
    return dnd && isValidElement<{ draggable?: boolean }>(node)
      ? cloneElement(node, { draggable: false })
      : node;
  };

  // Ohne Zeilen gibt es nichts auszurichten: der Ersatzinhalt steht für sich,
  // nicht in den Spalten der Tabelle.
  if (isEmpty && empty) {
    return (
      <div
        className={[
          styles.empty,
          fill && styles.fill,
          variant === "card" && styles.card,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {empty}
      </div>
    );
  }

  return (
    // Die Rollen wirken doppelt gemoppelt, sind es aber nicht: Browser leiten
    // die Tabellensemantik aus dem Layout ab und verwerfen sie, sobald
    // `display` überschrieben wird — hier durch das Grid. Ohne die Rollen
    // meldet ein Screenreader eine namenlose Gruppe statt einer Tabelle.
    // `noRedundantRoles`/`useSemanticElements` sind für diese Datei deshalb in
    // der biome.json abgeschaltet.
    <table
      className={root}
      style={trackStyle}
      role="table"
      aria-label={label}
      data-dnd={dnd ? "" : undefined}
      {...(dnd ? dnd.root : {})}
    >
      {/* Die einzige Stelle für eine Live-Region innerhalb einer <table>. Sie
          sagt an, was beim Sortieren per Tastatur zu sehen wäre; `role="status"`
          nimmt ihr die Rolle als Beschriftung der Tabelle. */}
      {dnd && (
        <caption className={styles.status} role="status">
          {dnd.status}
        </caption>
      )}

      {showHead && (
        <thead className={styles.group} role="rowgroup">
          <tr className={styles.headRow} role="row">
            {columns.map((column) => (
              <th
                key={column.id}
                className={cellClass(column)}
                role="columnheader"
                scope="col"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
      )}

      {sections.map((section) => (
        // `display: contents` — die Gruppe strukturiert nur, das Raster gehört
        // der Tabelle.
        <tbody
          key={section.id}
          className={styles.group}
          role="rowgroup"
          aria-label={section.label}
        >
          {section.header && (
            <tr
              className={styles.groupRow}
              role="row"
              {...(dnd ? dnd.groupHeader(section.id) : {})}
            >
              <th
                className={styles.groupCell}
                role="columnheader"
                scope="colgroup"
                colSpan={columns.length}
              >
                {section.header}
              </th>
            </tr>
          )}

          {!section.collapsed &&
            section.rows.map((row) => {
              const handle = dnd?.handle(row, section.id);
              return (
                <tr
                  key={getRowKey(row)}
                  className={styles.row}
                  role="row"
                  data-active={isRowActive?.(row) || undefined}
                  {...(dnd ? dnd.row(row, section.id) : {})}
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.id}
                      className={cellClass(column)}
                      role="cell"
                    >
                      {/* Griff und Overlay hängen in der ersten Zelle, gespannt
                        werden sie über die ganze Zeile. */}
                      {index === 0 && handle && (
                        <button
                          type="button"
                          className={styles.handle}
                          {...handle}
                        >
                          <svg
                            className={styles.grip}
                            viewBox="0 0 10 16"
                            aria-hidden="true"
                            focusable="false"
                          >
                            {GRIP_DOTS.map(([cx, cy]) => (
                              <circle
                                key={`${cx}-${cy}`}
                                cx={cx}
                                cy={cy}
                                r="1.15"
                              />
                            ))}
                          </svg>
                        </button>
                      )}
                      {index === 0 && rowOverlay && (
                        <div className={styles.overlay}>{overlayOf(row)}</div>
                      )}
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
        </tbody>
      ))}
    </table>
  );
}
