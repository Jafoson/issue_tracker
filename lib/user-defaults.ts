import "server-only";
import { db } from "@/lib/db";

// Color palette for generated avatars/accents of new users (credentials & OAuth).
const USER_COLORS = [
  "#6e63e6",
  "#3b9d6e",
  "#d5733b",
  "#3b7bd5",
  "#c2456b",
  "#a05fd0",
  "#cf9a3b",
];

/** Random accent color for a new user. */
export function pickUserColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

/**
 * Generates a unique `handle` from an email (preferred) or a name. Checks
 * the DB and appends a counter on collision. Used by credentials
 * registration and the Auth.js adapter's createUser (OAuth).
 */
export async function generateHandle(source: string): Promise<string> {
  const base =
    source
      .split("@")[0]
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase()
      .slice(0, 12) || "user";

  let handle = base;
  let suffix = 1;
  while (await db.user.findUnique({ where: { handle } })) {
    handle = `${base}${suffix++}`;
  }
  return handle;
}
