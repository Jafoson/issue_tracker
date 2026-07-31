import { describe, expect, test } from "bun:test";
import {
  filterSlashItems,
  normalize,
  type SlashCommandItem,
} from "@/components/ui/atoms/RichTextEditor/extensions/SlashCommand";
import { modKey } from "@/lib/a11y";

/**
 * Die Suche im `/`-Menü. Sie muss die Beschriftung treffen — die steht in der
 * eingestellten Sprache — **und** die hinterlegten Suchbegriffe, damit man
 * einen Befehl auch unter seinem Namen in der anderen Sprache findet.
 */

/** Ein Ausschnitt aus der echten Liste, mit deutschen Beschriftungen. */
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
  test("findet über die Beschriftung", () => {
    expect(ids("trennlinie")).toContain("horizontalRule");
    expect(ids("zitat")).toContain("blockquote");
  });

  test("findet über den englischen Begriff", () => {
    // Genau der Punkt: die Beschriftung ist deutsch, gesucht wird englisch.
    expect(ids("divider")).toContain("horizontalRule");
    expect(ids("quote")).toContain("blockquote");
    expect(ids("numbered")).toContain("orderedList");
  });

  test("findet über Kurzformen", () => {
    expect(ids("hr")).toContain("horizontalRule");
    expect(ids("h1")).toContain("heading1");
    expect(ids("ol")).toContain("orderedList");
  });

  test("kommt ohne Umlaute aus", () => {
    // Wer sucht, tippt selten Umlaute.
    expect(ids("uberschrift")).toContain("heading1");
    expect(ids("überschrift")).toContain("heading1");
  });

  test("stellt Treffer am Wortanfang nach vorn", () => {
    // Bewusst so herum aufgeschrieben, dass der Treffer in der Wortmitte
    // zuerst dasteht — die Sortierung muss ihn nach hinten schieben.
    const beide: SlashCommandItem[] = [
      { id: "mitte", label: "Nummerierte Liste", run: () => {} },
      { id: "anfang", label: "Liste", run: () => {} },
    ];
    expect(filterSlashItems(beide, "list").map((i) => i.id)).toEqual([
      "anfang",
      "mitte",
    ]);
  });

  test("behält innerhalb eines Rangs die vorgegebene Reihenfolge", () => {
    // `sort` ist stabil — die Ordnung aus `slashItems` bleibt erhalten.
    const gleichrangig: SlashCommandItem[] = [
      { id: "eins", label: "Liste A", run: () => {} },
      { id: "zwei", label: "Liste B", run: () => {} },
    ];
    expect(filterSlashItems(gleichrangig, "liste").map((i) => i.id)).toEqual([
      "eins",
      "zwei",
    ]);
  });

  test("lässt die Liste ohne Eingabe unverändert", () => {
    expect(filterSlashItems(items, "")).toBe(items);
    expect(filterSlashItems(items, "   ")).toBe(items);
  });

  test("nimmt beim Suchen die Gruppenköpfe weg", () => {
    const mitGruppe: SlashCommandItem[] = [
      { id: "table", label: "Tabelle", group: "Blöcke", run: () => {} },
    ];
    // Ungefiltert bleibt die Gliederung stehen …
    expect(filterSlashItems(mitGruppe, "")[0].group).toBe("Blöcke");
    // … beim Suchen fällt sie weg, sonst stünde derselbe Kopf mehrfach da.
    expect(filterSlashItems(mitGruppe, "tab")[0].group).toBeUndefined();
  });

  test("gibt bei fehlendem Treffer nichts zurück", () => {
    expect(ids("xyz")).toEqual([]);
  });
});

describe("normalize", () => {
  test("legt Groß-, Klein- und Umlautschreibung zusammen", () => {
    expect(normalize("Überschrift")).toBe("uberschrift");
    expect(normalize("  Aufzählung ")).toBe("aufzahlung");
    expect(normalize("Divider")).toBe("divider");
  });
});

describe("modKey", () => {
  test("nennt die Taste so, wie sie auf dem System heißt", () => {
    // Der Test läuft ohne `navigator` — dort ist „Ctrl" die sichere Annahme.
    expect(["⌘", "Strg", "Ctrl"]).toContain(modKey());
  });
});
