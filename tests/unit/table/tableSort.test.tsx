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
  // Without `sortValue`, the header stays a plain title — the control case
  // for everything above.
  { id: "actions", header: "", cell: () => null },
];

const rows: Row[] = [
  { id: "b", name: "Beta", issues: 10, lead: "Mia" },
  { id: "a", name: "Alpha", issues: 2, lead: null },
  { id: "c", name: "Gamma", issues: 2, lead: "Ada" },
];

/**
 * The hook holds state, so it only comes together inside a component. What's
 * checked is the initial view: the order in the markup and what the header
 * says about it. Click handlers only attach in the browser — the states
 * behind them are checked directly via `nextSortState`.
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

/** The names in the order they appear in the table. */
const order = (markup: string) =>
  [...markup.matchAll(/>(Alpha|Beta|Gamma)</g)].map((match) => match[1]);

describe("Table without sort", () => {
  test("leaves the headers as plain titles", () => {
    const markup = render(undefined, false);
    expect(markup).not.toContain("aria-sort");
    expect(markup).not.toContain("<button");
  });

  test("does not touch the order", () => {
    expect(order(render(undefined, false))).toEqual(["Beta", "Alpha", "Gamma"]);
  });
});

describe("Table with sort", () => {
  test("only makes columns with sortValue clickable", () => {
    const markup = render();
    // Three sortable columns, the actions column stays out of it.
    expect(markup.match(/<button/g)).toHaveLength(3);
    expect(markup.match(/aria-sort="none"/g)).toHaveLength(3);
  });

  test("keeps the base order when no column is selected", () => {
    expect(order(render())).toEqual(["Beta", "Alpha", "Gamma"]);
  });

  test("reports the selected column and its direction", () => {
    const markup = render({ columnId: "issues", direction: "desc" });
    expect(markup).toContain('aria-sort="descending"');
    expect(markup.match(/aria-sort="none"/g)).toHaveLength(2);
  });
});

describe("Sorting", () => {
  test("orders text by locale, ascending and descending", () => {
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

  test("orders numbers by magnitude, not as text", () => {
    // As text, 10 would sort before 2.
    expect(order(render({ columnId: "issues" }))).toEqual([
      "Alpha",
      "Gamma",
      "Beta",
    ]);
  });

  test("keeps equal values in their base order", () => {
    // Alpha and Gamma both have two issues and appear in the order they
    // came in.
    const sorted = order(render({ columnId: "issues" }));
    expect(sorted.indexOf("Alpha")).toBeLessThan(sorted.indexOf("Gamma"));
  });

  test("puts empty values at the end — in both directions", () => {
    // Alpha has no lead: "nothing" isn't a small value, it's a missing one,
    // and therefore never belongs at the start.
    expect(order(render({ columnId: "lead" })).at(-1)).toBe("Alpha");
    expect(order(render({ columnId: "lead", direction: "desc" })).at(-1)).toBe(
      "Alpha",
    );
  });
});

describe("nextSortState", () => {
  const none = { columnId: null, direction: "asc" as const };

  test("starts ascending on a new column", () => {
    expect(nextSortState(none, "name")).toEqual({
      columnId: "name",
      direction: "asc",
    });
  });

  test("reverses the selected column", () => {
    expect(
      nextSortState({ columnId: "name", direction: "asc" }, "name"),
    ).toEqual({ columnId: "name", direction: "desc" });
  });

  test("returns to the base order on the third click", () => {
    expect(
      nextSortState({ columnId: "name", direction: "desc" }, "name"),
    ).toEqual(none);
  });

  test("starts over on a different column", () => {
    expect(
      nextSortState({ columnId: "name", direction: "desc" }, "issues"),
    ).toEqual({ columnId: "issues", direction: "asc" });
  });
});
