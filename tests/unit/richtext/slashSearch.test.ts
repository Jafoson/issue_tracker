import { describe, expect, test } from "bun:test";
import {
  filterSlashItems,
  normalize,
  type SlashCommandItem,
} from "@/components/ui/layout/RichTextEditor/extensions/SlashCommand";
import { modKey } from "@/lib/a11y";

/**
 * The search inside the `/` menu. It has to match the label — which is in
 * the configured language — **and** the stored keywords, so a command can
 * also be found under its name in the other language.
 */

/** A slice of the real list, with German labels. */
const items: SlashCommandItem[] = [
  {
    id: "horizontalRule",
    label: "Trennlinie",
    keywords: ["divider", "trennlinie", "linie", "hr", "separator"],
    run: () => {},
  },
  {
    id: "table",
    label: "Tabelle",
    keywords: ["table", "tabelle", "raster"],
    run: () => {},
  },
  {
    id: "orderedList",
    label: "Nummerierte Liste",
    keywords: ["numbered list", "nummerierte liste", "ol"],
    run: () => {},
  },
  {
    id: "heading1",
    label: "Überschrift 1",
    keywords: ["heading 1", "überschrift 1", "h1"],
    run: () => {},
  },
  {
    id: "blockquote",
    label: "Zitat",
    keywords: ["quote", "zitat"],
    run: () => {},
  },
];

const ids = (query: string) => filterSlashItems(items, query).map((i) => i.id);

describe("filterSlashItems", () => {
  test("finds via the label", () => {
    expect(ids("trennlinie")).toContain("horizontalRule");
    expect(ids("zitat")).toContain("blockquote");
  });

  test("finds via the English term", () => {
    // That's exactly the point: the label is German, the search term is English.
    expect(ids("divider")).toContain("horizontalRule");
    expect(ids("quote")).toContain("blockquote");
    expect(ids("numbered")).toContain("orderedList");
  });

  test("finds via short forms", () => {
    expect(ids("hr")).toContain("horizontalRule");
    expect(ids("h1")).toContain("heading1");
    expect(ids("ol")).toContain("orderedList");
  });

  test("works without umlauts", () => {
    // People searching rarely type umlauts.
    expect(ids("uberschrift")).toContain("heading1");
    expect(ids("überschrift")).toContain("heading1");
  });

  test("ranks matches at the start of a word first", () => {
    // Deliberately written so the mid-word match is listed first — the
    // sorting has to push it back.
    const beide: SlashCommandItem[] = [
      { id: "mitte", label: "Nummerierte Liste", run: () => {} },
      { id: "anfang", label: "Liste", run: () => {} },
    ];
    expect(filterSlashItems(beide, "list").map((i) => i.id)).toEqual([
      "anfang",
      "mitte",
    ]);
  });

  test("keeps the given order within a rank", () => {
    // `sort` is stable — the order from `slashItems` is preserved.
    const gleichrangig: SlashCommandItem[] = [
      { id: "eins", label: "Liste A", run: () => {} },
      { id: "zwei", label: "Liste B", run: () => {} },
    ];
    expect(filterSlashItems(gleichrangig, "liste").map((i) => i.id)).toEqual([
      "eins",
      "zwei",
    ]);
  });

  test("leaves the list unchanged with no input", () => {
    expect(filterSlashItems(items, "")).toBe(items);
    expect(filterSlashItems(items, "   ")).toBe(items);
  });

  test("removes the group headers while searching", () => {
    const mitGruppe: SlashCommandItem[] = [
      { id: "table", label: "Tabelle", group: "Blöcke", run: () => {} },
    ];
    // Unfiltered, the grouping stays intact …
    expect(filterSlashItems(mitGruppe, "")[0].group).toBe("Blöcke");
    // … when searching it's dropped, otherwise the same heading would appear
    // multiple times.
    expect(filterSlashItems(mitGruppe, "tab")[0].group).toBeUndefined();
  });

  test("returns nothing when there is no match", () => {
    expect(ids("xyz")).toEqual([]);
  });
});

describe("normalize", () => {
  test("folds upper case, lower case, and umlaut spelling together", () => {
    expect(normalize("Überschrift")).toBe("uberschrift");
    expect(normalize("  Aufzählung ")).toBe("aufzahlung");
    expect(normalize("Divider")).toBe("divider");
  });
});

describe("modKey", () => {
  test("names the key the way the system does", () => {
    // The test runs without `navigator` — "Ctrl" is the safe assumption there.
    expect(["⌘", "Strg", "Ctrl"]).toContain(modKey());
  });
});
