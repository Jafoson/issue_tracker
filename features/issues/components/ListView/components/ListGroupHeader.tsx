"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/atoms/Button/Button";
import { CreateIssueModal } from "@/features/issues/components/CreateIssueModal/CreateIssueModal";
import { StatusIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import type { IssueComposerData } from "@/features/issues/types";
import { useModal } from "@/lib/context";
import type { Status } from "@/types";
import styles from "../listView.module.scss";

interface ListGroupHeaderProps {
  status: Status;
  count: number;
  projectId: string;
  composer: IssueComposerData;
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Kopf einer Statusgruppe — klappt ihre Zeilen ein und legt auf Wunsch ein
 * Issue direkt in diesem Status an. Gleiche Geste wie im Spaltenkopf des Boards.
 */
export function ListGroupHeader({
  status,
  count,
  projectId,
  composer,
  collapsed,
  onToggle,
}: ListGroupHeaderProps) {
  const t = useTranslations();
  const { openModal } = useModal();

  // Wie im Spaltenkopf des Boards: ohne `issue.create` in diesem Projekt fehlt
  // das Plus. Entschieden hat das der Server (`creatableProjectIds`).
  const canCreate = composer.creatableProjectIds.includes(projectId);

  const createIssue = () =>
    openModal(({ close }) => (
      <CreateIssueModal
        projectId={projectId}
        initialStatus={status.id}
        data={composer}
        close={close}
      />
    ));

  return (
    <>
      <button
        type="button"
        className={styles.groupToggle}
        onClick={onToggle}
        aria-expanded={!collapsed}
        title={t(collapsed ? "actions.expandGroup" : "actions.collapseGroup")}
        aria-label={t(
          collapsed ? "actions.expandGroup" : "actions.collapseGroup",
        )}
      >
        <Icon icon="lucide:chevron-down" width={13} />
      </button>
      <StatusIcon status={status.id} size={15} color={status.color} />
      <span className={styles.groupName}>{status.name}</span>
      <span className={styles.groupCount}>{count}</span>
      {canCreate && (
        <Button
          variant="ghost"
          size="sm"
          className={styles.groupAdd}
          title={t("actions.newIssue")}
          aria-label={t("actions.newIssue")}
          icon={<Icon icon="lucide:plus" width={15} />}
          onClick={createIssue}
        />
      )}
    </>
  );
}
