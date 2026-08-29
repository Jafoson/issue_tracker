"use client";

import {
  DASHBOARD_SCOPES,
  type DashboardScope,
} from "@/features/dashboard/scope";
import styles from "./scopePicker.module.scss";

interface Props {
  value: DashboardScope;
  onChange: (scope: DashboardScope) => void;
  /** Accessible name of the group, e.g. "Scope". */
  label: string;
  /** Label per scope — the translation comes in from outside. */
  labelFor: (scope: DashboardScope) => string;
}

/**
 * The scope of a dashboard: "just me" or "the whole project/workspace".
 *
 * Modeled on `RangePicker` (`components/ui/charts/RangePicker`) and for the
 * same reason not a `SegmentedControl`: the scope is a setting *above* the
 * content, not a view of it in its own right.
 *
 * Only appears when the person holds `dashboard.view.all` — someone without
 * it only ever sees their dashboard with `scope: "mine"` anyway, with no
 * need for a toggle.
 */
export function ScopePicker({ value, onChange, label, labelFor }: Props) {
  return (
    <fieldset className={styles.scopes} aria-label={label}>
      {DASHBOARD_SCOPES.map((scope) => (
        <button
          key={scope}
          type="button"
          className={styles.scope}
          data-active={value === scope || undefined}
          aria-pressed={value === scope}
          onClick={() => onChange(scope)}
        >
          {labelFor(scope)}
        </button>
      ))}
    </fieldset>
  );
}
