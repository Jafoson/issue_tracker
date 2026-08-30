import { describe, expect, test } from "bun:test";
import { effectiveRank, rankBetween, sortByRank } from "@/features/issues/rank";
import type { Issue } from "@/types";

/** Only the fields that matter here — the rest doesn't concern the calculation. */
const issue = (id: string, rank: number, created = 0) =>
  ({ id, rank, created }) as Issue;

describe("effectiveRank", () => {
  test("takes the rank as soon as one is set", () => {
    expect(effectiveRank(issue("a", 500, 9_000))).toBe(500);
  });

  test("falls back to the creation time when rank=0", () => {
    expect(effectiveRank(issue("a", 0, 9_000))).toBe(9_000);
  });
});

describe("sortByRank", () => {
  test("sorts ascending and leaves the input untouched", () => {
    const input = [issue("b", 200), issue("a", 100), issue("c", 300)];
    expect(sortByRank(input).map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(input.map((i) => i.id)).toEqual(["b", "a", "c"]);
  });

  test("mixes in never-before-sorted issues by their age", () => {
    // Rank and creation time are both milliseconds — they sit on the same
    // scale, so an unsorted issue ends up where it was created.
    const input = [issue("neu", 0, 300), issue("alt", 0, 100), issue("x", 200)];
    expect(sortByRank(input).map((i) => i.id)).toEqual(["alt", "x", "neu"]);
  });
});

describe("rankBetween", () => {
  test("places the rank between the neighbors", () => {
    expect(rankBetween(issue("a", 100), issue("b", 200))).toBe(150);
  });

  test("appends to the end when there's no successor", () => {
    expect(rankBetween(issue("a", 100), null)).toBe(1_100);
  });

  test("places before the first when there's no predecessor", () => {
    expect(rankBetween(null, issue("a", 100))).toBe(-900);
  });

  test("stays between the neighbors, even after several moves", () => {
    let previous = issue("a", 100);
    const next = issue("b", 200);
    for (let step = 0; step < 5; step++) {
      const rank = rankBetween(previous, next);
      expect(rank).toBeGreaterThan(effectiveRank(previous));
      expect(rank).toBeLessThan(effectiveRank(next));
      previous = issue(`step-${step}`, rank);
    }
  });

  test("falls back to the clock for an empty list", () => {
    const before = Date.now();
    const rank = rankBetween(null, null);
    expect(rank).toBeGreaterThanOrEqual(before);
  });
});
