"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { type CSSProperties, useRef, useState } from "react";
import { Label } from "@/components/ui/atoms/Label/Label";
import { AssigneePicker } from "@/features/issues/components/AssigneePicker/AssigneePicker";
import {
  PriorityIcon,
  TypeIcon,
} from "@/features/issues/components/IssueIcons/IssueIcons";
import { IssueTitleField } from "@/features/issues/components/IssueTitleField/IssueTitleField";
import { isBrowserClick } from "@/features/issues/issue-links";
import type { IssueLookups } from "@/features/issues/types";
import { useIssuePatch } from "@/features/issues/useIssuePatch";
import { onActivate } from "@/lib/a11y";
import { useTimeAgo } from "@/lib/utils/useTimeAgo";
import type { Issue, Label as LabelType } from "@/types";
import styles from "./boardCard.module.scss";
import { useRowFit } from "./useRowFit";
import { useTextEnd } from "./useTextEnd";

interface BoardCardProps {
  issue: Issue;
  projectId: string;
  lookups: IssueLookups;
  isDragging?: boolean;
  /**
   * Ob dieses Issue gerade im Seitenpanel steht. Die Karte bleibt dann
   * markiert — sonst wäre nach dem Klick nicht mehr zu sehen, wovon das Panel
   * eigentlich spricht.
   */
  isActive?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  /** Der gewöhnliche Klick: Panel über dem Board. */
  onOpen?: () => void;
  /**
   * Strg/Cmd- und Mittelklick: die Vollseite in einem neuen Tab.
   *
   * Die Karte ist kein Link — sie ist ziehbar, und ein Anker darüber würde
   * beim Ziehen den Link mitnehmen statt die Karte. Also fragt sie die Taste
   * selbst ab, statt es dem Browser zu überlassen.
   */
  onOpenInNewTab?: () => void;
}

export function BoardCard({
  issue,
  projectId,
  lookups: { members, projects, labels, issueTypes },
  isDragging,
  isActive,
  onDragStart,
  onDragEnd,
  onDragOver,
  onOpen,
  onOpenInNewTab,
}: BoardCardProps) {
  const t = useTranslations();
  const timeAgo = useTimeAgo();
  const { patch } = useIssuePatch(issue.id);
  const [isEditing, setIsEditing] = useState(false);

  // Der Server zieht erst nach dem Schreiben nach. Bis dahin zeigt die Karte,
  // was gerade eingetippt wurde — sonst blitzte der alte Titel wieder auf.
  // Sobald von außen ein neuer Titel eintrifft, gilt wieder der.
  const [written, setWritten] = useState<string | null>(null);
  const [known, setKnown] = useState(issue.title);
  if (issue.title !== known) {
    setKnown(issue.title);
    setWritten(null);
  }
  const title = written ?? issue.title;

  // Wo der Titel aufhört — daran hängt der Stift.
  const { ref: titleRef, end: textEnd } = useTextEnd(title);

  // Ein Klick daneben beendet das Schreiben — dabei soll er nicht auch noch die
  // Karte öffnen. Bis `mousedown` durch ist, hat der Fokus das Feld noch nicht
  // verlassen; hier steht also, ob gerade geschrieben wurde. Jedes `mousedown`
  // setzt den Merker neu, damit kein alter Stand einen späteren Klick schluckt.
  const wasEditing = useRef(false);

  const project = projects.find((p) => p.id === issue.project) ??
    projects.find((p) => p.id === projectId) ?? {
      prefix: "?",
      name: "?",
      color: "#686d76",
    };
  const identifier = `${project.prefix}-${issue.key}`;
  const typeLabel = issue.type
    ? issue.type.charAt(0).toUpperCase() + issue.type.slice(1)
    : null;
  const typeColor = issue.type
    ? (issueTypes.find((x) => x.id === issue.type)?.color ?? "#686d76")
    : null;
  const issueLabels = issue.labels
    .map((lid) => labels.find((x) => x.id === lid) ?? null)
    .filter((l): l is LabelType => l !== null);

  // Die Labels bleiben auf einer Zeile — was nicht mehr danebenpasst, steht als
  // Zahl am Ende. Eine feste Obergrenze täte es nicht: ob drei Labels passen,
  // hängt an ihren Namen und an der Breite der Spalte, die sich ziehen lässt.
  const { ref: labelRow, fit } = useRowFit(
    issueLabels.length,
    issueLabels.map((l) => l.name).join("|"),
  );
  const shownLabels = fit === null ? issueLabels : issueLabels.slice(0, fit);
  const restLabels = issueLabels.length - shownLabels.length;

  return (
    // biome-ignore lint/a11y/useSemanticElements: card contains block-level content; a <button> would be invalid HTML
    <div
      className={`${styles.card}${isDragging ? ` ${styles.dragging}` : ""}`}
      role="button"
      tabIndex={0}
      // Dieselbe Sprache wie die Zeilen der Liste (`Table`): der Zustand steht
      // im Attribut, das Aussehen im Stylesheet.
      data-active={isActive || undefined}
      aria-current={isActive || undefined}
      // Beim Schreiben nicht: ein ziehbarer Vorfahr nimmt dem Feld sonst das
      // Markieren mit der Maus weg.
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onMouseDown={() => {
        wasEditing.current = isEditing;
      }}
      onClick={(e) => {
        if (wasEditing.current) {
          wasEditing.current = false;
          return;
        }
        if (isBrowserClick(e)) onOpenInNewTab?.();
        else onOpen?.();
      }}
      // Die mittlere Maustaste meldet sich nicht über `onClick`. Ohne
      // `preventDefault` schaltet sie außerdem den Auto-Scroll ein.
      onAuxClick={(e) => {
        if (e.button !== 1) return;
        e.preventDefault();
        onOpenInNewTab?.();
      }}
      onKeyDown={onActivate(() => onOpen?.())}
    >
      {/* Kopfzeile: Typ-Badge + Assignee. Der Avatar ist zugleich der Auslöser
        für die Zuweisung — sie zu ändern, ist der häufigste Griff an einer
        Karte, und dafür soll sie sich nicht erst öffnen müssen. */}
      <div className={styles.header}>
        {typeLabel && typeColor && (
          <Label color={typeColor} filled hasIcon size="xs">
            <TypeIcon type={issue.type} size={10} color={typeColor} />
            {typeLabel}
          </Label>
        )}
        <AssigneePicker issue={issue} members={members} size={30} />
      </div>

      {isEditing ? (
        <IssueTitleField
          className={styles.titleEdit}
          value={title}
          onSave={(value) => {
            setWritten(value);
            patch({ title: value });
          }}
          onDone={() => setIsEditing(false)}
        />
      ) : (
        // Der Stift liegt über dem Titel und wird an dessen gemessenes Ende
        // gesetzt: hinter das letzte Wort, und wo dort kein Platz mehr ist, auf
        // das Zeilenende. Im Textfluss stehen kann er nicht — die Begrenzung auf
        // drei Zeilen schnitte ihn bei langen Titeln mit ab.
        <div className={styles.titleRow}>
          <p className={styles.title} ref={titleRef}>
            {title}
          </p>
          <button
            type="button"
            className={styles.editTitle}
            style={
              textEnd
                ? ({
                    "--title-end-x": `${textEnd.x}px`,
                    "--title-end-y": `${textEnd.y}px`,
                  } as CSSProperties)
                : undefined
            }
            title={t("actions.editTitle")}
            aria-label={t("actions.editTitle")}
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            <Icon icon="lucide:pencil" width={13} />
          </button>
        </div>
      )}

      {issueLabels.length > 0 && (
        <div className={styles.labels} ref={labelRow}>
          {shownLabels.map((l) => (
            <Label key={l.id} color={l.color} size="xs">
              {l.name}
            </Label>
          ))}
          {/* Im Messdurchgang (`fit === null`) steht der Zähler mit der größten
              möglichen Zahl da, damit seine Breite in die Rechnung eingeht —
              gesehen wird er dabei nicht. */}
          {(fit === null || restLabels > 0) && (
            <Label
              size="xs"
              className={fit === null ? styles.probe : undefined}
              title={
                fit === null
                  ? undefined
                  : issueLabels
                      .slice(fit)
                      .map((l) => l.name)
                      .join(", ")
              }
            >
              +{fit === null ? issueLabels.length : restLabels}
            </Label>
          )}
        </div>
      )}

      {/* Meta: Priorität + Identifier | Zeit + Kommentare */}
      <div className={styles.footer}>
        <PriorityIcon priority={issue.priority} size={14} />
        <span className={styles.id}>{identifier}</span>
        <span className={styles.time}>{timeAgo(issue.updated)}</span>
        {issue.comments.length > 0 && (
          <span className={styles.comments}>
            <Icon icon="lucide:message-square" width={12} aria-hidden="true" />
            {issue.comments.length}
          </span>
        )}
      </div>
    </div>
  );
}
