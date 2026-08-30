import type { Issue } from "@/types";

/**
 * The ordering of issues — the same calculation for board and list.
 *
 * The rank is a floating-point number, not a position: there's always
 * another number that fits between two neighbors. Reordering therefore
 * writes exactly one row, not the whole column.
 */

/** `rank = 0` means "never sorted yet" — the creation time counts instead. */
export const effectiveRank = (issue: Issue) =>
  issue.rank !== 0 ? issue.rank : issue.created;

export const sortByRank = <T extends Issue>(issues: T[]): T[] =>
  [...issues].sort((a, b) => effectiveRank(a) - effectiveRank(b));

/**
 * The rank for a spot between two neighbors. If one is missing, it's about
 * the start or end of the list; if both are missing, the list is empty and
 * the timestamp provides a rank consistent with the rest.
 */
export const rankBetween = (previous: Issue | null, next: Issue | null) => {
  if (previous && next)
    return (effectiveRank(previous) + effectiveRank(next)) / 2;
  if (previous) return effectiveRank(previous) + 1000;
  if (next) return effectiveRank(next) - 1000;
  return Date.now();
};
