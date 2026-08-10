import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import {
  nextSortState,
  type TableSortOptions,
  useTableSort,
} from "@/components/ui/layout/Table/useTableSort";

interface Row {
  id: string;
  name: string;
  issues: number;
  lead: string | null;
}

const columns: TableColumn<Row>[] = [
  {
    id: "name",
    header: "Projekt",
    sortValue: (row) => row.name,
    cell: (row) => <span>{row.name}</span>,
  },
  {
    id: "issues",
    header: "Aufgaben",
    sortValue: (row) => row.issues,
    cell: (row) => <span>{row.issues}</span>,
  },
  {
    id: "lead",
    header: "Lead",
    sortValue: (row) => row.lead,
    cell: (row) => <span>{row.lead}</span>,
  },
  // Ohne `sortValue` bleibt der Kopf ein Titel — die Gegenprobe zu allem
  // darüber.
  { id: "actions", header: "", cell: () => null },
];

const rows: Row[] = [
  { id: "b", name: "Beta", issues: 10, lead: "Mia" },
  { id: "a", name: "Alpha", issues: 2, lead: null },
  { id: "c", name: "Gamma", issues: 2, lead: "Ada" },
];

/**
 * Der Hook hält Zustand, entsteht also nur in einer Komponente. Geprüft wird die
 * Ausgangsansicht: die Reihenfolge im Markup und was der Kopf über sie sagt.
 * Klicks hängen erst im Browser daran — die Stufen dahinter prüft
 * `nextSortState` direkt.
 */
const render = (options?: TableSortOptions, withSort = true) => {
  const Fixture = () => {
    const { sort, sortRows } = useTableSort(columns, options);
    return (
      <Table
        columns={columns}
        rows={sortRows(rows)}
        sort={withSort ? sort : undefined}
        getRowKey={(row) => row.id}
      />
    );
  };
  return renderToStaticMarkup(<Fixture />);
};

/** Die Namen in der Reihenfolge, in der sie in der Tabelle stehen. */
const order = (markup: string) =>
  [...markup.matchAll(/>(Alpha|Beta|Gamma)</g)].map((match) => match[1]);

describe("Table ohne sort", () => {
  test("lässt die Köpfe Titel bleiben", () => {
    const markup = render(undefined, false);
    expect(markup).not.toContain("aria-sort");
    expect(markup).not.toContain("<button");
  });

  test("rührt die Reihenfolge nicht an", () => {
    expect(order(render(undefined, false))).toEqual(["Beta", "Alpha", "Gamma"]);
  });
});

describe("Table mit sort", () => {
  test("macht nur Spalten mit sortValue anklickbar", () => {
    const markup = render();
    // Drei sortierbare Spalten, die Aktionsspalte bleibt außen vor.
    expect(markup.match(/<button/g)).toHaveLength(3);
    expect(markup.match(/aria-sort="none"/g)).toHaveLength(3);
  });

  test("hält ohne gewählte Spalte die Grundordnung", () => {
    expect(order(render())).toEqual(["Beta", "Alpha", "Gamma"]);
  });

  test("meldet die gewählte Spalte und ihre Richtung", () => {
    const markup = render({ columnId: "issues", direction: "desc" });
    expect(markup).toContain('aria-sort="descending"');
    expect(markup.match(/aria-sort="none"/g)).toHaveLength(2);
  });
});

describe("Sortieren", () => {
  test("ordnet Text der Sprache nach, auf- und absteigend", () => {
    expect(order(render({ columnId: "name" }))).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
    expect(order(render({ columnId: "name", direction: "desc" }))).toEqual([
      "Gamma",
      "Beta",
      "Alpha",
    ]);
  });

  test("ordnet Zahlen der Größe nach, nicht als Text", () => {
    // Als Text stünde 10 vor 2.
    expect(order(render({ columnId: "issues" }))).toEqual([
      "Alpha",
      "Gamma",
      "Beta",
    ]);
  });

  test("hält gleiche Werte in ihrer Grundordnung", () => {
    // Alpha und Gamma haben beide zwei Aufgaben und stehen in der Reihenfolge,
    // in der sie hereinkamen.
    const sorted = order(render({ columnId: "issues" }));
    expect(sorted.indexOf("Alpha")).toBeLessThan(sorted.indexOf("Gamma"));
  });

  test("stellt Leeres ans Ende — in beide Richtungen", () => {
    // Alpha hat keinen Lead: „nichts" ist kein kleiner Wert, sondern ein
    // fehlender, und gehört deshalb nie an den Anfang.
    expect(order(render({ columnId: "lead" })).at(-1)).toBe("Alpha");
    expect(order(render({ columnId: "lead", direction: "desc" })).at(-1)).toBe(
      "Alpha",
    );
  });
});

describe("nextSortState", () => {
  const none = { columnId: null, direction: "asc" as const };

  test("beginnt bei einer neuen Spalte aufsteigend", () => {
    expect(nextSortState(none, "name")).toEqual({
      columnId: "name",
      direction: "asc",
    });
  });

  test("dreht die gewählte Spalte um", () => {
    expect(
      nextSortState({ columnId: "name", direction: "asc" }, "name"),
    ).toEqual({ columnId: "name", direction: "desc" });
  });

  test("gibt beim dritten Klick die Grundordnung zurück", () => {
    expect(
      nextSortState({ columnId: "name", direction: "desc" }, "name"),
    ).toEqual(none);
  });

  test("fängt bei einer anderen Spalte wieder von vorn an", () => {
    expect(
      nextSortState({ columnId: "name", direction: "desc" }, "issues"),
    ).toEqual({ columnId: "issues", direction: "asc" });
  });
});
