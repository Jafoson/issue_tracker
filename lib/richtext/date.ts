/**
 * Die Beschriftung eines Datums-Chips.
 *
 * Gespeichert wird ISO (`2026-08-14`) — eindeutig und sortierbar. Angezeigt
 * wird die lokale Schreibweise. Beide Renderer teilen sich diese Funktion,
 * sonst stünde im Editor „14. Aug 2026" und in der Anzeige die Rohform.
 *
 * Ohne feste Sprache: sie richtet sich nach der Umgebung. Auf dem Server ist
 * das eine andere als im Browser — die Anzeige markiert das `<time>` deshalb
 * mit `suppressHydrationWarning`, und der maschinenlesbare Wert steht ohnehin
 * unverändert im `datetime`-Attribut.
 */
export function formatChipDate(iso: string): string {
  // Mittags statt Mitternacht: sonst kippt der Kalendertag in Zeitzonen
  // westlich von UTC auf den Vortag.
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Der Kalendertag von heute, verschoben um `offsetDays`. */
export function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** `2026-08-14` aus den Einzelteilen — mit führenden Nullen. */
export function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Zweistellige Jahreszahlen: `02` wird 2002, `98` wird 1998.
 *
 * Die Grenze bei 68 ist die aus POSIX und wird von den meisten Programmen so
 * gezogen — in einem Issue-Tracker liegt ohnehin fast alles in der Zukunft.
 */
function fullYear(value: number): number {
  if (value >= 100) return value;
  return value <= 68 ? 2000 + value : 1900 + value;
}

/** Gibt es den Tag wirklich? `31.02.` sieht sonst gültig aus. */
function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

/** `1.2.2002` · `01.02.02` · `1.2.` · `1-2-2002` — Tag zuerst, wie hierzulande. */
const DAY_FIRST = /^(\d{1,2})[.-](\d{1,2})[.-]?(\d{2,4})?\.?$/;
/** `2002-02-01` — vier Stellen vorn, also ISO. */
const ISO_LIKE = /^(\d{4})[-.](\d{1,2})[-.](\d{1,2})$/;

/**
 * Liest ein getipptes Datum und gibt es als ISO zurück — oder `null`.
 *
 * Gedacht für das `/`-Menü: wer `/1.2.2002` tippt, soll den Chip direkt
 * angeboten bekommen, ohne den Umweg über den Kalender.
 *
 * Angenommen werden die hier üblichen Schreibweisen mit Punkt oder Bindestrich
 * sowie die ISO-Form. Ohne Jahr gilt das laufende, zweistellige Jahre werden
 * ergänzt. Der Schrägstrich ist bewusst **nicht** dabei: er öffnet das Menü und
 * würde die Eingabe mittendrin abschneiden.
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
    // Ohne Jahresangabe das laufende Jahr.
    const year =
      local[3] === undefined
        ? new Date().getFullYear()
        : fullYear(Number(local[3]));
    return isRealDate(year, month, day) ? toIso(year, month, day) : null;
  }

  return null;
}
