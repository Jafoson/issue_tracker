import { describe, expect, test } from "bun:test";
import { effectiveRank, rankBetween, sortByRank } from "@/features/issues/rank";
import type { Issue } from "@/types";

/** Nur die Felder, um die es hier geht — der Rest interessiert die Rechnung nicht. */
const issue = (id: string, rank: number, created = 0) =>
  ({ id, rank, created }) as Issue;

describe("effectiveRank", () => {
  test("nimmt den Rang, sobald einer gesetzt ist", () => {
    expect(effectiveRank(issue("a", 500, 9_000))).toBe(500);
  });

  test("weicht bei rank=0 auf den Anlagezeitpunkt aus", () => {
    expect(effectiveRank(issue("a", 0, 9_000))).toBe(9_000);
  });
});

describe("sortByRank", () => {
  test("sortiert aufsteigend und lässt die Eingabe unberührt", () => {
    const input = [issue("b", 200), issue("a", 100), issue("c", 300)];
    expect(sortByRank(input).map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(input.map((i) => i.id)).toEqual(["b", "a", "c"]);
  });

  test("mischt noch nie sortierte Issues über ihr Alter ein", () => {
    // Rang wie Anlagezeitpunkt sind Millisekunden — beide liegen auf derselben
    // Skala, ein unsortiertes Issue landet also dort, wo es entstanden ist.
    const input = [issue("neu", 0, 300), issue("alt", 0, 100), issue("x", 200)];
    expect(sortByRank(input).map((i) => i.id)).toEqual(["alt", "x", "neu"]);
  });
});

describe("rankBetween", () => {
  test("legt den Rang zwischen die Nachbarn", () => {
    expect(rankBetween(issue("a", 100), issue("b", 200))).toBe(150);
  });

  test("hängt ans Ende, wenn kein Nachfolger da ist", () => {
    expect(rankBetween(issue("a", 100), null)).toBe(1_100);
  });

  test("setzt vor den ersten, wenn kein Vorgänger da ist", () => {
    expect(rankBetween(null, issue("a", 100))).toBe(-900);
  });

  test("bleibt zwischen den Nachbarn, auch nach mehreren Zügen", () => {
    let previous = issue("a", 100);
    const next = issue("b", 200);
    for (let step = 0; step < 5; step++) {
      const rank = rankBetween(previous, next);
      expect(rank).toBeGreaterThan(effectiveRank(previous));
      expect(rank).toBeLessThan(effectiveRank(next));
      previous = issue(`step-${step}`, rank);
    }
  });

  test("greift bei leerer Liste auf die Uhr zurück", () => {
    const before = Date.now();
    const rank = rankBetween(null, null);
    expect(rank).toBeGreaterThanOrEqual(before);
  });
});
