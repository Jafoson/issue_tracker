/**
 * The label of a date chip.
 *
 * What's stored is ISO (`2026-08-14`) — unambiguous and sortable. What's
 * shown is the locale's own notation. Both renderers share this function,
 * otherwise the editor would show "Aug 14, 2026" and the display the raw
 * form.
 *
 * No fixed locale: it follows the environment. On the server that's a
 * different one than in the browser — the display therefore marks the
 * `<time>` with `suppressHydrationWarning`, and the machine-readable value
 * sits unchanged in the `datetime` attribute regardless.
 */
export function formatChipDate(iso: string): string {
  // Noon instead of midnight: otherwise the calendar day tips over to the
  // previous day in time zones west of UTC.
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Today's calendar day, shifted by `offsetDays`. */
export function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** `2026-08-14` from the individual parts — with leading zeros. */
export function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Two-digit years: `02` becomes 2002, `98` becomes 1998.
 *
 * The cutoff at 68 is the one from POSIX and is what most programs use —
 * in an issue tracker, almost everything lies in the future anyway.
 */
function fullYear(value: number): number {
  if (value >= 100) return value;
  return value <= 68 ? 2000 + value : 1900 + value;
}

/** Does the day actually exist? `31.02.` would otherwise look valid. */
function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

/** `1.2.2002` · `01.02.02` · `1.2.` · `1-2-2002` — day first, as customary here. */
const DAY_FIRST = /^(\d{1,2})[.-](\d{1,2})[.-]?(\d{2,4})?\.?$/;
/** `2002-02-01` — four digits up front, so ISO. */
const ISO_LIKE = /^(\d{4})[-.](\d{1,2})[-.](\d{1,2})$/;

/**
 * Reads a typed date and returns it as ISO — or `null`.
 *
 * Meant for the `/` menu: whoever types `/1.2.2002` should be offered the
 * chip directly, without the detour through the calendar.
 *
 * The notations accepted are the ones customary here, with a dot or a
 * hyphen, plus the ISO form. Without a year, the current one applies;
 * two-digit years get expanded. The slash is deliberately **not** among
 * them: it opens the menu and would cut the input off midway.
 */
export function parseDateInput(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  const iso = ISO_LIKE.exec(text);
  if (iso) {
    const [, y, m, d] = iso.map(Number);
    return isRealDate(y, m, d) ? toIso(y, m, d) : null;
  }

  const local = DAY_FIRST.exec(text);
  if (local) {
    const day = Number(local[1]);
    const month = Number(local[2]);
    // The current year when none is given.
    const year =
      local[3] === undefined
        ? new Date().getFullYear()
        : fullYear(Number(local[3]));
    return isRealDate(year, month, day) ? toIso(year, month, day) : null;
  }

  return null;
}
