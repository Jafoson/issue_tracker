import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Table,
  type TableColumn,
  type TableGroup,
} from "@/components/ui/layout/Table/Table";
import {
  type TableDndOptions,
  useTableDnd,
} from "@/components/ui/layout/Table/useTableDnd";

interface Row {
  id: string;
  name: string;
}

const columns: TableColumn<Row>[] = [
  { id: "name", cell: (row) => <span>{row.name}</span> },
];

const rows: Row[] = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
];

const groups: TableGroup<Row>[] = [
  { id: "open", header: <span>Offen</span>, rows: [rows[0]] },
  { id: "done", header: <span>Erledigt</span>, rows: [rows[1]] },
];

/**
 * Die Bindung entsteht nur in einer Komponente — der Hook hält Zustand. Für die
 * Ausgangsansicht reicht `renderToStaticMarkup`: Ereignisse hängen ohnehin erst
 * im Browser daran, geprüft wird hier, was ohne sie im Markup steht.
 */
const Sortable = (options?: Partial<TableDndOptions<Row>>) => {
  const Fixture = () => {
    const dnd = useTableDnd<Row>({
      rows,
      getRowKey: (row) => row.id,
      rowLabel: (row) => `${row.name} verschieben`,
      onDrop: () => {},
      ...options,
    });
    return (
      <Table
        {...(options?.groups ? { groups: options.groups } : { rows })}
        columns={columns}
        getRowKey={(row) => row.id}
        dnd={dnd}
      />
    );
  };
  return renderToStaticMarkup(<Fixture />);
};

describe("Table ohne dnd", () => {
  const markup = renderToStaticMarkup(
    <Table rows={rows} columns={columns} getRowKey={(row) => row.id} />,
  );

  test("bleibt eine Ansicht ohne Griff und ohne Ziehen", () => {
    expect(markup).not.toContain("draggable");
    expect(markup).not.toContain("data-dnd");
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("<caption");
  });
});

describe("Table mit dnd", () => {
  test("markiert die Tabelle und macht jede Zeile ziehbar", () => {
    const markup = Sortable();
    expect(markup).toContain('data-dnd=""');
    expect(markup.match(/draggable="true"/g)).toHaveLength(rows.length);
  });

  test("gibt jeder Zeile einen benannten Griff", () => {
    const markup = Sortable();
    expect(markup).toContain('aria-label="Alpha verschieben"');
    expect(markup).toContain('aria-label="Beta verschieben"');
    // Aufgenommen wird erst per Tastatur — vorher ist kein Griff gedrückt.
    expect(markup.match(/aria-pressed="false"/g)).toHaveLength(rows.length);
    expect(markup).not.toContain("data-grabbed");
  });

  test("hält eine stumme Live-Region für die Ansagen bereit", () => {
    expect(Sortable()).toContain('<caption class="status" role="status">');
  });

  test("lässt Zeilen liegen, für die `canDrag` verneint", () => {
    const markup = Sortable({ canDrag: (row) => row.id !== "b" });
    expect(markup).toContain('aria-label="Alpha verschieben"');
    expect(markup).not.toContain('aria-label="Beta verschieben"');
    // Die Zeile bleibt Teil der Tabelle, sie ist nur nicht mehr ziehbar.
    expect(markup).toContain("Beta");
    expect(markup.match(/draggable="true"/g)).toHaveLength(1);
  });

  test("zeigt ohne Zug keine Einfügelinie — auch nicht in Gruppen", () => {
    const markup = Sortable({ groups });
    expect(markup).toContain("Offen");
    expect(markup).toContain("Erledigt");
    expect(markup).not.toContain("data-drop");
    expect(markup).not.toContain("data-dragging");
  });
});
