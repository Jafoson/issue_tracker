import type { ReactNode } from "react";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import styles from "./settingsList.module.scss";

/** Eine Einstellung als Zeile: worum es geht, was sie bedeutet, womit man sie ändert. */
export interface SettingsRow {
  id: string;
  label: string;
  desc?: ReactNode;
  /** Das Bedienelement — bei genau einer Spalte (der Regelfall). */
  control?: ReactNode;
  /** Bei mehreren Spalten: je Spalten-Id ein Bedienelement. */
  cells?: Record<string, ReactNode>;
}

/** Eine Spalte mit Bedienelementen, wenn eine nicht reicht. */
export interface SettingsColumn {
  id: string;
  header: string;
  /** Grid-Track. Vorgabe: `104px` — schmal genug, dass die Köpfe zählen. */
  width?: string;
}

interface Props {
  rows: SettingsRow[];
  /** Überschrift über der Liste. Ohne sie steht die Liste für sich. */
  title?: string;
  /** Name der Liste für Screenreader. Vorgabe: `title`. */
  label?: string;
  /**
   * Mehrere Bedienspalten statt einer — jede mit eigenem Kopf, die Zellen dann
   * in `row.cells`. Ohne diese Prop trägt jede Zeile genau ein Bedienelement
   * (`row.control`) und die Liste kommt ohne Kopfzeile aus.
   */
  columns?: SettingsColumn[];
  /** Warnfarbe im Rahmen — für Zeilen, die sich nicht zurücknehmen lassen. */
  danger?: boolean;
  className?: string;
}

const SETTING_COLUMN: TableColumn<SettingsRow> = {
  id: "setting",
  width: "minmax(0, 1fr)",
  cell: (row) => (
    <div className={styles.setting}>
      <span className={styles.label}>{row.label}</span>
      {row.desc && <span className={styles.desc}>{row.desc}</span>}
    </div>
  ),
};

/**
 * Eine Liste von Einstellungen: links, worum es geht (Beschriftung über
 * Erklärung), rechts, womit man es ändert.
 *
 * Dasselbe Raster, das die Projekt- und Workspace-Einstellungen von Hand
 * aufbauen — hier einmal als Baustein, weil die eigenen Einstellungen fünf
 * Bereiche haben und fünf Kopien desselben Rasters fünf Gelegenheiten wären,
 * auseinanderzulaufen.
 *
 * Eine Einstellung ist keine Liste gleichartiger Datensätze, sondern ein
 * Formular. Deshalb weicht die Tabelle darunter in drei Werten von ihrer Vorgabe
 * ab (siehe `settingsList.module.scss`): die Zeile trägt zwei Textzeilen und
 * braucht Höhe, sie ist von der nächsten getrennt, und sie leuchtet nicht auf —
 * anzuklicken gibt es nur das Bedienelement rechts.
 */
export function SettingsList({
  rows,
  title,
  label,
  columns,
  danger = false,
  className,
}: Props) {
  const controlColumns: TableColumn<SettingsRow>[] = columns
    ? columns.map((column) => ({
        id: column.id,
        header: column.header,
        width: column.width ?? "104px",
        align: "center",
        cell: (row) => row.cells?.[column.id] ?? null,
      }))
    : [
        {
          id: "control",
          // Jedes Bedienelement in derselben Breite, damit die rechten Kanten
          // eine Linie bilden.
          width: "minmax(280px, max-content)",
          align: "end",
          cell: (row) => row.control ?? null,
        },
      ];

  const table = (
    <Table
      variant="card"
      className={[styles.table, danger && styles.danger, className]
        .filter(Boolean)
        .join(" ")}
      label={label ?? title}
      columns={[SETTING_COLUMN, ...controlColumns]}
      rows={rows}
      getRowKey={(row) => row.id}
    />
  );

  if (!title) return table;

  return (
    <section className={styles.group}>
      <h2
        className={[styles.title, danger && styles.dangerTitle]
          .filter(Boolean)
          .join(" ")}
      >
        {title}
      </h2>
      {table}
    </section>
  );
}

/**
 * Der scrollende Teil einer Einstellungsseite — alles unter der Kopfzeile.
 *
 * Steht hier statt in jedem Bereich noch einmal: die Kopfzeile (`PageHeader`)
 * bleibt oben, die Listen darunter scrollen, und der Abstand zwischen ihnen ist
 * überall derselbe. Fünf eigene Stylesheets für denselben Kasten wären fünf
 * Gelegenheiten, dass er woanders anders aussieht.
 */
export function SettingsBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={[styles.body, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
