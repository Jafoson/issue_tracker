// ─── Die Bausteine des Projekt-Dashboards ────────────────────────────────────
//
// Abhängigkeitsfrei: keine DB, kein `server-only`, kein React. Die Serverseite
// braucht die Liste, um nur zu laden, was auch gezeigt wird; die Oberfläche
// braucht sie, um zu zeichnen; der Anpassen-Dialog, um sie zur Auswahl zu
// stellen. Drei Leser, eine Wahrheit — und Tests, die ohne Datenbank laufen.

/** Jeder Baustein, den das Dashboard kennt. */
export const WIDGET_KEYS = [
  "stats",
  "status",
  "throughput",
  "priority",
  "workload",
  "attention",
] as const;

export type WidgetKey = (typeof WIDGET_KEYS)[number];

/**
 * Wie breit ein Baustein steht.
 *
 * `full` nimmt die ganze Zeile, `half` teilt sie sich mit einem Nachbarn. Die
 * Angabe steht hier und nicht im Stylesheet, weil sie zum Baustein gehört und
 * nicht zur Seite: verschiebt jemand die Reihenfolge, sollen die Breiten
 * mitwandern, ohne dass irgendwo eine zweite Liste nachgezogen werden muss.
 */
export type WidgetSpan = "half" | "full";

export interface WidgetDef {
  key: WidgetKey;
  span: WidgetSpan;
  /** Zeichen im Anpassen-Dialog — dasselbe wie im Kopf des Bausteins. */
  icon: string;
  /**
   * Bausteine, die sich nicht ausblenden lassen.
   *
   * Genau einer: die Kennzahlenreihe. Ein Dashboard, auf dem weder eine Zahl
   * noch ein Diagramm steht, ist kein eingerichtetes Dashboard, sondern eine
   * leere Seite, von der aus niemand mehr zurückfindet — die Reihe bleibt der
   * Anker, an dem die Anpassung immer noch zu erreichen ist.
   */
  permanent?: boolean;
}

/**
 * Die Vorgabe: Reihenfolge und Breite, wenn niemand etwas verstellt hat.
 *
 * Von grob nach fein, wie im Plattform-Dashboard: erst der Zustand in Zahlen,
 * dann wie er sich verteilt und entwickelt, dann wo die Arbeit liegt — und
 * zuletzt die Liste, die auf einzelne Aufgaben zeigt.
 */
export const WIDGETS: WidgetDef[] = [
  { key: "stats", span: "full", icon: "lucide:layout-grid", permanent: true },
  { key: "status", span: "half", icon: "lucide:chart-pie" },
  { key: "throughput", span: "half", icon: "lucide:chart-column" },
  { key: "priority", span: "half", icon: "lucide:signal-high" },
  { key: "workload", span: "half", icon: "lucide:users" },
  { key: "attention", span: "full", icon: "lucide:triangle-alert" },
];

const BY_KEY = new Map(WIDGETS.map((widget) => [widget.key, widget]));

export function widgetDef(key: WidgetKey): WidgetDef {
  const found = BY_KEY.get(key);
  // Kann nicht vorkommen, solange `WidgetKey` aus `WIDGETS` stammt — und wäre,
  // wenn doch, ein fehlender Eintrag und keine Kleinigkeit.
  if (!found) throw new Error(`Unknown dashboard widget: ${key}`);
  return found;
}

/** Ist das ein Baustein, den es gibt? Filtert, was aus der Datenbank kommt. */
export function isWidgetKey(value: string): value is WidgetKey {
  return (WIDGET_KEYS as readonly string[]).includes(value);
}

export interface DashboardLayout {
  /** Die sichtbaren Bausteine, in der Reihenfolge, in der sie stehen. */
  visible: WidgetKey[];
  /** Die ausgeblendeten — für den Anpassen-Dialog, der sie zurückholen kann. */
  hidden: WidgetKey[];
}

/**
 * Die gespeicherte Einstellung zu einer Anordnung machen.
 *
 * Beide Eingaben sind Wünsche, keine Wahrheit: sie stammen aus einer Zeile, die
 * älter sein kann als die Liste der Bausteine. Deshalb wird nichts von dort
 * geglaubt, sondern alles gegen `WIDGETS` geprüft.
 *
 * Zwei Regeln, die zusammen dafür sorgen, dass ein neu ergänzter Baustein auch
 * bei denen erscheint, die schon einmal etwas verschoben haben:
 *
 *   1. `order` führt, ist aber nicht vollständig — was darin fehlt, kommt
 *      danach in der Reihenfolge der Vorgabe.
 *   2. Ausgeblendet ist nur, was ausdrücklich in `hidden` steht. Ein
 *      unbekannter Baustein ist neu, nicht abgewählt.
 *
 * Der umgekehrte Weg — nur die sichtbaren speichern — wäre kürzer und hätte
 * genau diesen Fehler: ein später ergänzter Baustein stünde in keiner
 * gespeicherten Liste und bliebe für immer unsichtbar.
 */
export function resolveLayout(
  order: string[] = [],
  hidden: string[] = [],
): DashboardLayout {
  const hiddenSet = new Set(hidden.filter(isWidgetKey));

  // Erst die gespeicherte Reihenfolge (ohne Unbekanntes und ohne Dubletten),
  // dann alles, was die Vorgabe noch kennt.
  const seen = new Set<WidgetKey>();
  const ordered: WidgetKey[] = [];

  for (const key of order) {
    if (!isWidgetKey(key) || seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  for (const widget of WIDGETS) {
    if (seen.has(widget.key)) continue;
    seen.add(widget.key);
    ordered.push(widget.key);
  }

  return {
    // Was nicht ausgeblendet werden *darf*, bleibt sichtbar, auch wenn es in
    // `hidden` steht — eine alte Zeile kann von einer Zeit stammen, in der das
    // noch ging.
    visible: ordered.filter(
      (key) => !hiddenSet.has(key) || widgetDef(key).permanent,
    ),
    hidden: ordered.filter(
      (key) => hiddenSet.has(key) && !widgetDef(key).permanent,
    ),
  };
}

/**
 * Einen Baustein um einen Platz verschieben — die Bewegung des Anpassen-Dialogs.
 *
 * Verschoben wird innerhalb der sichtbaren Liste; am Rand passiert nichts. Rein
 * rechnerisch und ohne Zustand, damit der Dialog nur noch das Ergebnis
 * speichern muss.
 */
export function moveWidget(
  order: WidgetKey[],
  key: WidgetKey,
  direction: -1 | 1,
): WidgetKey[] {
  const from = order.indexOf(key);
  if (from < 0) return order;

  const to = from + direction;
  if (to < 0 || to >= order.length) return order;

  const next = [...order];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
