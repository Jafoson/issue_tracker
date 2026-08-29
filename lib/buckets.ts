// ─── Time axes for the dashboard ─────────────────────────────────────────────
//
// Dependency-free: no DB, no `server-only`. The queries need the axis to
// fill gaps, and the tests check it without a database.
//
// **The axis is generated here, not in the database.** A grouping only
// yields days something happened — a chart built from that would have no
// zeros, just no points at all, and a quiet weekend would look like a
// continuous line. That's why the axis is generated in full and the numbers
// are placed into it; whatever's missing is a zero.

/** The time ranges the dashboard offers. */
export const RANGES = ["7d", "30d", "90d", "12m"] as const;

export type RangeKey = (typeof RANGES)[number];

/** The step size the axis runs in. */
export type BucketUnit = "day" | "week" | "month";

interface RangeSpec {
  unit: BucketUnit;
  /** How many steps the axis carries, including the current one. */
  steps: number;
}

/**
 * One step size per range — chosen so the axis carries between 7 and 30
 * marks.
 *
 * That's the readability limit in both directions: 90 daily bars are a comb
 * you can no longer make sense of, and 12 daily bars for a year wouldn't
 * answer "how has this developed". That's why a year runs in months, a
 * quarter in weeks, and everything shorter in days.
 */
const SPECS: Record<RangeKey, RangeSpec> = {
  "7d": { unit: "day", steps: 7 },
  "30d": { unit: "day", steps: 30 },
  "90d": { unit: "week", steps: 13 },
  "12m": { unit: "month", steps: 12 },
};

export function rangeSpec(range: RangeKey): RangeSpec {
  return SPECS[range];
}

/** Narrows a value from the address bar to a known range. */
export function toRange(value: string | undefined): RangeKey {
  return (RANGES as readonly string[]).includes(value ?? "")
    ? (value as RangeKey)
    : "30d";
}

// ─── Steps on the axis ─────────────────────────────────────────────────────────
//
// Everything is computed in local time, matching `date_trunc` in the
// database: the server groups in its own time zone, and the axis has to
// draw the same boundaries, or numbers end up in the neighboring bucket.

function startOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** Week starts on Monday — like `date_trunc('week', …)` in PostgreSQL. */
function startOfWeek(date: Date): Date {
  const out = startOfDay(date);
  // `getDay()` counts from Sunday; starting on Monday means Sunday is the
  // seventh day, not the first.
  const weekday = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - weekday);
  return out;
}

function startOfMonth(date: Date): Date {
  const out = startOfDay(date);
  out.setDate(1);
  return out;
}

/** Determine the start of the bucket this point in time falls into. */
export function truncate(date: Date, unit: BucketUnit): Date {
  if (unit === "month") return startOfMonth(date);
  if (unit === "week") return startOfWeek(date);
  return startOfDay(date);
}

/** One bucket forward (or backward, with a negative `count`). */
export function step(date: Date, unit: BucketUnit, count: number): Date {
  const out = new Date(date);
  if (unit === "month") out.setMonth(out.getMonth() + count);
  else if (unit === "week") out.setDate(out.getDate() + count * 7);
  else out.setDate(out.getDate() + count);
  return out;
}

/**
 * The key of a bucket: `YYYY-MM-DD`, in local time.
 *
 * Deliberately not `toISOString()` — that converts to UTC and would shift
 * every bucket back a day east of Greenwich.
 */
export function bucketKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface Window {
  /** First bucket of the range, set to its start. */
  from: Date;
  /** First bucket **after** the range — upper bound, not included. */
  to: Date;
  unit: BucketUnit;
  /** All bucket keys in order, with no gaps. */
  keys: string[];
}

/**
 * The displayed range, going backward from `now`.
 *
 * The current bucket counts too and is usually incomplete — today isn't
 * over yet. That's deliberate: an overview that hides the current day
 * doesn't answer the question "what's happening right now".
 */
export function windowFor(range: RangeKey, now = new Date()): Window {
  const { unit, steps } = rangeSpec(range);
  const current = truncate(now, unit);
  const from = step(current, unit, -(steps - 1));
  const to = step(current, unit, 1);

  const keys: string[] = [];
  for (let i = 0; i < steps; i++) {
    keys.push(bucketKey(step(from, unit, i)));
  }

  return { from, to, unit, keys };
}

/**
 * The equally long range before it — the basis for every change figure.
 *
 * "+12% versus the 30 days before" is a statement; "+12%" alone is not.
 */
export function previousWindow(current: Window, range: RangeKey): Window {
  const { unit, steps } = rangeSpec(range);
  const from = step(current.from, unit, -steps);

  const keys: string[] = [];
  for (let i = 0; i < steps; i++) {
    keys.push(bucketKey(step(from, unit, i)));
  }

  return { from, to: current.from, unit, keys };
}

/**
 * The change versus the previous range, in percent.
 *
 * `null` if there was nothing before: going from zero to ten isn't a
 * hundredfold increase, it's a beginning — and "+∞%" isn't information.
 */
export function trend(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
