"use client";

import {
  DASHBOARD_SCOPES,
  type DashboardScope,
} from "@/features/dashboard/scope";
import styles from "./scopePicker.module.scss";

interface Props {
  value: DashboardScope;
  onChange: (scope: DashboardScope) => void;
  /** Barrierefreier Name der Gruppe, z. B. „Umfang". */
  label: string;
  /** Beschriftung je Umfang — die Übersetzung kommt von außen herein. */
  labelFor: (scope: DashboardScope) => string;
}

/**
 * Der Umfang eines Dashboards: „nur ich" oder „das ganze Projekt/Workspace".
 *
 * Nach dem Vorbild von `RangePicker` (`components/ui/charts/RangePicker`) und
 * aus demselben Grund kein `SegmentedControl`: der Umfang ist eine Einstellung
 * *über* dem Inhalt, keine eigene Ansicht davon.
 *
 * Erscheint nur, wenn die Person `dashboard.view.all` trägt — wer sie nicht
 * hat, sieht ihr Dashboard ohnehin nur mit `scope: "mine"`, ohne dass es dafür
 * einen Umschalter bräuchte.
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
