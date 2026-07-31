"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { EditableRichText } from "@/components/ui/layout/RichTextEditor/EditableRichText";
import type {
  IssueSource,
  MentionSource,
} from "@/components/ui/layout/RichTextEditor/RichTextEditor";
import { StatusIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import type { IssueEditorData } from "@/features/issues/types";
import type { PMDoc } from "@/lib/richtext/types";
import { fullName } from "@/lib/utils/string";

/**
 * Die fachliche Hülle um `EditableRichText`.
 *
 * `components/ui` darf nichts über Workspaces, Mitglieder oder Issue-Schlüssel
 * wissen — hier wird beides zusammengeführt: aus den Workspace-Daten werden die
 * Listen für `@` und `#`, samt Avatar und Status-Icon.
 *
 * Beschreibung und Kommentare benutzen dieselbe Komponente, damit sie sich
 * gleich verhalten und nicht auseinanderlaufen.
 */

interface IssueRichTextProps {
  value: PMDoc | unknown;
  onCommit: (value: PMDoc) => void;
  /** Siehe `EditableRichText` — live statt erst beim Verlassen. */
  onChange?: (value: PMDoc) => void;
  data: IssueEditorData;
  label: string;
  placeholder?: string;
  saveLabel?: string;
  cancelLabel?: string;
  /** Siehe `EditableRichText` — aus, wo ein Dialog eigene Knöpfe trägt. */
  actions?: boolean;
  className?: string;
}

/** Baut die Vorschlagslisten einmal pro Datenstand. */
export function useEditorSources(data: IssueEditorData): {
  members: MentionSource[];
  issues: IssueSource[];
} {
  return useMemo(() => {
    const members: MentionSource[] = data.members.map((m) => ({
      id: m.id,
      name: fullName(m),
      avatar: <Avatar avatar={m} size={20} />,
    }));

    const issues: IssueSource[] = data.searchIssues.map((i) => {
      const project = data.projects.find((p) => p.id === i.project);
      return {
        id: i.id,
        identifier: `${project?.prefix ?? "?"}-${i.key}`,
        title: i.title,
        icon: (
          <StatusIcon
            status={i.status}
            size={15}
            color={data.statuses.find((s) => s.id === i.status)?.color}
          />
        ),
      };
    });

    return { members, issues };
  }, [data.members, data.searchIssues, data.projects, data.statuses]);
}

export function IssueRichText({
  value,
  onCommit,
  onChange,
  data,
  label,
  placeholder,
  saveLabel,
  cancelLabel,
  actions,
  className,
}: IssueRichTextProps) {
  const { members, issues } = useEditorSources(data);
  const t = useTranslations("editor");

  return (
    <EditableRichText
      labels={{
        copy: t("copy"),
        copied: t("copied"),
      }}
      value={value}
      onCommit={onCommit}
      onChange={onChange}
      label={label}
      placeholder={placeholder}
      saveLabel={saveLabel}
      cancelLabel={cancelLabel}
      actions={actions}
      members={members}
      issues={issues}
      className={className}
    />
  );
}
