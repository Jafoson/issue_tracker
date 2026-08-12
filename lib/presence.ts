import "server-only";
import { db } from "@/lib/db";

// ─── „Zuletzt online" ─────────────────────────────────────────────────────────
//
// Die Plattformverwaltung braucht die Angabe, um tote Konten von benutzten zu
// unterscheiden — nicht, um jemandem beim Arbeiten zuzusehen. Sie ist deshalb
// mit Absicht grob: eine Genauigkeit von einer Stunde beantwortet „wird dieses
// Konto noch benutzt?" genauso gut wie eine von einer Sekunde, kostet aber nicht
// bei jedem Seitenaufruf einen Schreibvorgang.
//
// Zwei Bremsen liegen hintereinander. Die erste ist ein Merker im Prozess: wer
// gerade eben schon gezählt wurde, löst nicht einmal eine Abfrage aus. Die
// zweite steht in der `WHERE`-Bedingung und gilt auch dann, wenn mehrere
// Instanzen laufen oder der Prozess neu gestartet ist — dort entscheidet die
// Datenbank, nicht der Merker.

const INTERVAL_MS = 60 * 60 * 1000;

/**
 * Wen dieser Prozess zuletzt wann durchgelassen hat.
 *
 * Nur eine Abkürzung, keine Wahrheit: geht der Merker verloren, entscheidet die
 * Bedingung in der Abfrage — es wird höchstens einmal zu oft geschrieben.
 */
const seen = new Map<string, number>();

/**
 * Ein Lebenszeichen festhalten, höchstens einmal je Stunde und Konto.
 *
 * Schluckt seine Fehler: dass die Spalte eine Stunde alt bleibt, darf keine
 * Seite kosten.
 */
export async function touchLastSeen(userId: string): Promise<void> {
  const now = Date.now();
  const last = seen.get(userId);
  if (last !== undefined && now - last < INTERVAL_MS) return;
  seen.set(userId, now);

  try {
    // `updateMany` statt `update`: die Bedingung ist der eigentliche Punkt — so
    // schreibt die Datenbank nur, wenn der Wert wirklich alt ist, und zwei
    // Instanzen kommen sich nicht in die Quere. `update` kennt kein `where`
    // jenseits des Schlüssels und müsste erst lesen.
    await db.user.updateMany({
      where: {
        id: userId,
        OR: [
          { lastSeenAt: null },
          { lastSeenAt: { lt: new Date(now - INTERVAL_MS) } },
        ],
      },
      data: { lastSeenAt: new Date(now) },
    });
  } catch (error) {
    seen.delete(userId);
    console.error("[presence] lastSeenAt nicht geschrieben:", error);
  }
}
