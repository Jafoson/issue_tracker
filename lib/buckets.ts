// ─── Zeitachsen für das Dashboard ─────────────────────────────────────────────
//
// Abhängigkeitsfrei: keine DB, kein `server-only`. Die Abfragen brauchen die
// Achse, um Lücken zu füllen, und die Tests prüfen sie ohne Datenbank.
//
// **Die Achse entsteht hier, nicht in der Datenbank.** Eine Gruppierung liefert
// nur Tage, an denen etwas passiert ist — ein Diagramm daraus hätte keine
// Nullen, sondern gar keine Punkte, und ein ruhiges Wochenende sähe aus wie eine
// durchgehende Linie. Deshalb wird die Achse vollständig erzeugt und die Zahlen
// werden hineingelegt; was fehlt, ist eine Null.

/** Die Zeiträume, die das Dashboard anbietet. */
export const RANGES = ["7d", "30d", "90d", "12m"] as const;

export type RangeKey = (typeof RANGES)[number];

/** In welchen Schritten die Achse läuft. */
export type BucketUnit = "day" | "week" | "month";

interface RangeSpec {
  unit: BucketUnit;
  /** Wie viele Schritte die Achse trägt, den laufenden eingeschlossen. */
  steps: number;
}

/**
 * Je Zeitraum eine Schrittweite — so, dass die Achse zwischen 7 und 30 Marken
 * trägt.
 *
 * Das ist die Grenze der Lesbarkeit in beide Richtungen: 90 Tagessäulen sind ein
 * Kamm, in dem man nichts mehr erkennt, und 12 Tagessäulen für ein Jahr wären
 * keine Antwort auf „wie hat sich das entwickelt". Ein Jahr läuft deshalb in
 * Monaten, ein Quartal in Wochen, alles Kürzere in Tagen.
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

/** Narrowt einen Wert aus der Adresszeile auf einen bekannten Zeitraum. */
export function toRange(value: string | undefined): RangeKey {
  return (RANGES as readonly string[]).includes(value ?? "")
    ? (value as RangeKey)
    : "30d";
}

// ─── Schritte auf der Achse ───────────────────────────────────────────────────
//
// Alles rechnet in lokaler Zeit, passend zu `date_trunc` in der Datenbank: der
// Server gruppiert in seiner Zeitzone, und die Achse muss dieselben Grenzen
// ziehen, sonst landen Zahlen im Nachbartopf.

function startOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** Wochenanfang ist Montag — wie `date_trunc('week', …)` in PostgreSQL. */
function startOfWeek(date: Date): Date {
  const out = startOfDay(date);
  // `getDay()` zählt ab Sonntag; Montag als Anfang heißt: Sonntag ist der
  // siebte Tag, nicht der erste.
  const weekday = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - weekday);
  return out;
}

function startOfMonth(date: Date): Date {
  const out = startOfDay(date);
  out.setDate(1);
  return out;
}

/** Den Anfang des Topfes bestimmen, in dem dieser Zeitpunkt liegt. */
export function truncate(date: Date, unit: BucketUnit): Date {
  if (unit === "month") return startOfMonth(date);
  if (unit === "week") return startOfWeek(date);
  return startOfDay(date);
}

/** Einen Topf weiter (oder mit negativem `count` zurück). */
export function step(date: Date, unit: BucketUnit, count: number): Date {
  const out = new Date(date);
  if (unit === "month") out.setMonth(out.getMonth() + count);
  else if (unit === "week") out.setDate(out.getDate() + count * 7);
  else out.setDate(out.getDate() + count);
  return out;
}

/**
 * Der Schlüssel eines Topfes: `YYYY-MM-DD`, in lokaler Zeit.
 *
 * Bewusst nicht `toISOString()` — das rechnet nach UTC um und schöbe östlich von
 * Greenwich jeden Topf um einen Tag zurück.
 */
export function bucketKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface Window {
  /** Erster Topf des Zeitraums, auf seinen Anfang gesetzt. */
  from: Date;
  /** Erster Topf **nach** dem Zeitraum — obere Grenze, nicht enthalten. */
  to: Date;
  unit: BucketUnit;
  /** Alle Topf-Schlüssel in Reihenfolge, lückenlos. */
  keys: string[];
}

/**
 * Der angezeigte Zeitraum, von `now` aus rückwärts.
 *
 * Der laufende Topf zählt mit und ist meist unvollständig — der heutige Tag ist
 * noch nicht vorbei. Das ist Absicht: eine Übersicht, die den aktuellen Tag
 * verschweigt, beantwortet die Frage „was ist gerade los" nicht.
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
 * Der gleich lange Zeitraum davor — die Grundlage jeder Veränderungsangabe.
 *
 * „+12 % gegenüber den 30 Tagen davor" ist eine Aussage; „+12 %" allein ist
 * keine.
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
 * Die Veränderung gegenüber dem Zeitraum davor, in Prozent.
 *
 * `null`, wenn vorher nichts da war: von null auf zehn ist keine
 * Verhundertfachung, sondern ein Anfang — und „+∞ %" ist keine Auskunft.
 */
export function trend(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
