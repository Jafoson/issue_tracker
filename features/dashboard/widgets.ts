// ─── The project dashboard's widgets ────────────────────────────────────────
//
// Dependency-free: no DB, no `server-only`, no React. The server side needs
// the list to only load what's actually shown; the UI needs it to render;
// the customize dialog needs it to offer as choices. Three readers, one
// source of truth — and tests that run without a database.

/** Every widget the dashboard knows about. */
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
 * How wide a widget sits.
 *
 * `full` takes the whole row, `half` shares it with a neighbor. This lives
 * here and not in the stylesheet, because it belongs to the widget, not the
 * page: if someone reorders the widgets, the widths should travel along
 * without a second list needing to be updated anywhere.
 */
export type WidgetSpan = "half" | "full";

export interface WidgetDef {
  key: WidgetKey;
  span: WidgetSpan;
  /** Icon in the customize dialog — the same one as in the widget's header. */
  icon: string;
  /**
   * Widgets that can't be hidden.
   *
   * Exactly one: the key-figures row. A dashboard with neither a number nor
   * a chart on it isn't a configured dashboard, it's an empty page nobody
   * can find their way back from — the row stays the anchor from which
   * customization can still be reached.
   */
  permanent?: boolean;
}

/**
 * The default: order and width when nobody has changed anything.
 *
 * From coarse to fine, like the platform dashboard: first the state in
 * numbers, then how it's distributed and developing, then where the work
 * sits — and finally the list pointing to individual issues.
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
  // Can't happen as long as `WidgetKey` derives from `WIDGETS` — and if it
  // did, it would be a missing entry, not a minor issue.
  if (!found) throw new Error(`Unknown dashboard widget: ${key}`);
  return found;
}

/** Is this a widget that actually exists? Filters what comes from the database. */
export function isWidgetKey(value: string): value is WidgetKey {
  return (WIDGET_KEYS as readonly string[]).includes(value);
}

export interface DashboardLayout {
  /** The visible widgets, in the order they appear. */
  visible: WidgetKey[];
  /** The hidden ones — for the customize dialog, which can bring them back. */
  hidden: WidgetKey[];
}

/**
 * Turn the stored setting into a layout.
 *
 * Both inputs are wishes, not truth: they come from a row that can be older
 * than the list of widgets. So nothing from there is trusted blindly —
 * everything is checked against `WIDGETS`.
 *
 * Two rules that together ensure a newly added widget also appears for
 * people who've already rearranged something:
 *
 *   1. `order` leads, but isn't complete — whatever's missing from it comes
 *      afterward, in the default order.
 *   2. Only what's explicitly listed in `hidden` counts as hidden. An
 *      unknown widget is new, not deselected.
 *
 * The reverse approach — save only the visible ones — would be shorter and
 * would have exactly this bug: a widget added later wouldn't appear in any
 * saved list and would stay invisible forever.
 */
export function resolveLayout(
  order: string[] = [],
  hidden: string[] = [],
): DashboardLayout {
  const hiddenSet = new Set(hidden.filter(isWidgetKey));

  // First the saved order (with no unknowns and no duplicates), then
  // everything the default still knows about.
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
    // Whatever *can't* be hidden stays visible, even if it's listed in
    // `hidden` — an old row might date back to a time when that was still
    // allowed.
    visible: ordered.filter(
      (key) => !hiddenSet.has(key) || widgetDef(key).permanent,
    ),
    hidden: ordered.filter(
      (key) => hiddenSet.has(key) && !widgetDef(key).permanent,
    ),
  };
}

/**
 * Move a widget by one spot — the customize dialog's move action.
 *
 * Movement happens within the visible list; nothing happens at the edge.
 * Purely computational and stateless, so the dialog only has to save the
 * result.
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
