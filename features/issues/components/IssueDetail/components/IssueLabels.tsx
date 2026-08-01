"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { Label as LabelChip } from "@/components/ui/atoms/Label/Label";
import { LabelPickerMenu } from "@/features/issues/components/LabelPickerMenu/LabelPickerMenu";
import type { IssueComposerData, IssuePatch } from "@/features/issues/types";
import type { Issue, Label } from "@/types";
import styles from "../issueDetail.module.scss";
import type { IssueDetailLayout } from "../types";

interface IssueLabelsProps {
  issue: Issue;
  data: IssueComposerData;
  layout: IssueDetailLayout;
  onPatch: (patch: IssuePatch) => void;
}

/**
 * Die Labels des Issues.
 *
 * In der Spalte ein eigener Abschnitt unter der Beschreibung, in der
 * Attributspalte ein Block zwischen zwei Trennlinien. Beide Male stehen die
 * Chips unter ihrer Beschriftung statt daneben: mehrere brauchen die volle
 * Breite, sonst bricht schon das zweite um.
 *
 * Nur der Weg zum Hinzufügen unterscheidet sich. In der Spalte schließt ein
 * gestrichelter Chip die Reihe ab — dort ist Platz, und ein Leerzustand in
 * Worten erübrigt sich damit. In der schmalen Attributspalte sitzt das Plus in
 * der Kopfzeile, wo es keine Chip-Breite kostet.
 */
export function IssueLabels({
  issue,
  data,
  layout,
  onPatch,
}: IssueLabelsProps) {
  const { labels, projects } = data;
  const t = useTranslations();

  // Im Label-Picker neu angelegte Labels kennt die Server-Prop noch nicht —
  // bis zum nächsten Refresh kommen sie von hier.
  const [createdLabels, setCreatedLabels] = useState<Label[]>([]);
  const knownLabels = [
    ...labels,
    ...createdLabels.filter((l) => !labels.some((known) => known.id === l.id)),
  ];

  const isAside = layout === "aside";
  const project = projects.find((p) => p.id === issue.project);
  const issueLabels = issue.labels
    .map((id) => knownLabels.find((l) => l.id === id))
    .filter((l): l is Label => Boolean(l));

  const toggleLabel = (id: string) =>
    onPatch({
      labels: issue.labels.includes(id)
        ? issue.labels.filter((x) => x !== id)
        : [...issue.labels, id],
    });

  const picker = (trigger: React.ReactElement) => (
    <InlinePicker
      width={240}
      align={isAside ? "end" : "start"}
      stop
      trigger={trigger}
    >
      {(close) => (
        <LabelPickerMenu
          allLabels={knownLabels}
          selected={issue.labels}
          projectId={issue.project}
          projectName={project?.name ?? ""}
          workspaceId={data.workspaceId}
          onPick={toggleLabel}
          onCreated={(label) => setCreatedLabels((cur) => [...cur, label])}
          onClose={close}
          keepOpen
        />
      )}
    </InlinePicker>
  );

  const chips = issueLabels.map((label) => (
    <LabelChip
      key={label.id}
      color={label.color}
      size="sm"
      // Derselbe Weg wie über das Menü — `toggleLabel` nimmt es heraus, wenn
      // es schon gesetzt ist.
      onRemove={() => toggleLabel(label.id)}
      removeLabel={t("actions.removeLabel", { name: label.name })}
    >
      {label.name}
    </LabelChip>
  ));

  if (isAside) {
    return (
      <div className={styles.labels}>
        <div className={styles.labelsHead}>
          <span className={styles.rowLabel}>{t("fields.labels")}</span>
          {picker(
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={t("actions.addLabel")}
              title={t("actions.addLabel")}
            >
              <Icon icon="lucide:plus" width={14} />
            </button>,
          )}
        </div>
        {issueLabels.length > 0 ? (
          <div className={`${styles.labelsList} ${styles.labelsListAside}`}>
            {chips}
          </div>
        ) : (
          <span className={styles.labelsEmpty}>{t("fields.none")}</span>
        )}
      </div>
    );
  }

  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <Icon icon="lucide:tag" width={15} aria-hidden="true" />
        <h3 className={styles.sectionTitle}>{t("fields.labels")}</h3>
      </header>

      <div className={styles.labelsList}>
        {chips}
        {picker(
          <button
            type="button"
            className={styles.addLabel}
            aria-label={t("actions.addLabel")}
            title={t("actions.addLabel")}
          >
            <Icon icon="lucide:plus" width={13} aria-hidden="true" />
            {issueLabels.length === 0 && <span>{t("fields.label")}</span>}
          </button>,
        )}
      </div>
    </section>
  );
}
