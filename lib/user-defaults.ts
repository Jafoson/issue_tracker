import "server-only";
import { db } from "@/lib/db";

// Farbpalette für generierte Avatare/Akzente neuer User (Credentials & OAuth).
const USER_COLORS = [
  "#6e63e6",
  "#3b9d6e",
  "#d5733b",
  "#3b7bd5",
  "#c2456b",
  "#a05fd0",
  "#cf9a3b",
];

/** Zufällige Akzentfarbe für einen neuen User. */
export function pickUserColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

/**
 * Erzeugt einen eindeutigen `handle` aus E-Mail (bevorzugt) oder Name. Prüft die
 * DB und hängt bei Kollision einen Zähler an. Genutzt von Credentials-Register
 * und dem Auth.js-Adapter-createUser (OAuth).
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
