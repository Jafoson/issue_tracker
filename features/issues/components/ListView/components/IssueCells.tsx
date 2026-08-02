"use client";

import { useFormatter, useTranslations } from "next-intl";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { Label } from "@/components/ui/atoms/Label/Label";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import {
  PriorityIcon,
  StatusIcon,
  TypeIcon,
} from "@/features/issues/components/IssueIcons/IssueIcons";
import { useIssuePatch } from "@/features/issues/useIssuePatch";
import type {
  Issue,
  IssueType,
  Label as LabelType,
  Priority,
  Status,
} from "@/types";
import styles from "../listView.module.scss";

/** Mehr Labels passen nicht in eine Zeile, ohne den Titel zu verdrängen. */
const MAX_LABELS = 2;

// ── Bedienbare Zellen: ändern das Issue direkt aus der Liste heraus ───────────

export function PriorityCell({
  issue,
  priorities,
}: {
  issue: Issue;
  priorities: Priority[];
}) {
  const t = useTranslations();
  const { patch } = useIssuePatch(issue.id);
  const current = priorities.find((p) => p.id === issue.priority);

  return (
    <InlinePicker
      width={190}
      stop
      trigger={
        <button
          type="button"
          className={styles.pickerBtn}
          title={current?.name ?? t("fields.priority")}
          aria-label={t("fields.priority")}
        >
          <PriorityIcon priority={issue.priority} size={15} />
        </button>
      }
    >
      {(close) => (
        <SelectMenu
          items={priorities.map((p) => ({
            value: p.id,
            label: p.name,
            icon: <PriorityIcon priority={p.id} size={15} />,
          }))}
          value={issue.priority}
          onPick={(value) => {
            patch({ priority: value as number });
            close();
          }}
          onClose={close}
        />
      )}
    </InlinePicker>
  );
}

export function StatusCell({
  issue,
  statuses,
}: {
  issue: Issue;
  statuses: Status[];
}) {
  const t = useTranslations();
  const { patch } = useIssuePatch(issue.id);
  const current = statuses.find((s) => s.id === issue.status);

  return (
    <InlinePicker
      width={200}
      stop
      trigger={
        <button
          type="button"
          className={styles.pickerBtn}
          title={current?.name ?? t("fields.status")}
          aria-label={t("fields.status")}
        >
          <StatusIcon status={issue.status} size={15} color={current?.color} />
        </button>
      }
    >
      {(close) => (
        <SelectMenu
          items={statuses.map((s) => ({
            value: s.id,
            label: s.name,
            icon: <StatusIcon status={s.id} size={15} color={s.color} />,
          }))}
          value={issue.status}
          onPick={(value) => {
            patch({ status: value as string });
            close();
          }}
          onClose={close}
        />
      )}
    </InlinePicker>
  );
}

/* Die Zuweisung liegt als eigene Komponente daneben — Liste und Board zeigen
   denselben Avatar und ändern ihn auf demselben Weg:
   features/issues/components/AssigneePicker. */

// ── Anzeigende Zellen ────────────────────────────────────────────────────────

export function TypeCell({
  issue,
  issueTypes,
}: {
  issue: Issue;
  issueTypes: IssueType[];
}) {
  const type = issueTypes.find((x) => x.id === issue.type);
  if (!type) return null;

  return (
    <span
      className={styles.type}
      role="img"
      aria-label={type.name}
      title={type.name}
    >
      <TypeIcon type={type.id} size={13} color={type.color} />
    </span>
  );
}

export function LabelsCell({
  issue,
  labels,
}: {
  issue: Issue;
  labels: LabelType[];
}) {
  const resolved = issue.labels
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is LabelType => Boolean(l));
  const shown = resolved.slice(0, MAX_LABELS);
  const rest = resolved.length - shown.length;

  return (
    <>
      {shown.map((label) => (
        <Label key={label.id} color={label.color} size="sm">
          {label.name}
        </Label>
      ))}
      {rest > 0 && <Label size="sm">+{rest}</Label>}
    </>
  );
}

/**
 * Kurzdatum statt "vor 3 Tagen": in einer Spalte gelesen zählt der Zeitpunkt,
 * nicht der Abstand — und alle Zeilen bleiben gleich breit. Der volle
 * Zeitstempel hängt im Tooltip.
 */
export function UpdatedCell({ issue }: { issue: Issue }) {
  const format = useFormatter();

  return (
    <span
      className={styles.date}
      title={format.dateTime(issue.updated, {
        dateStyle: "long",
        timeStyle: "short",
      })}
    >
      {format.dateTime(issue.updated, { month: "short", day: "numeric" })}
    </span>
  );
}
