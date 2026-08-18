"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { issuePath } from "@/features/issues/issue-links";
import { Link } from "@/i18n/navigation";
import { useModal } from "@/lib/context";
import type { User } from "@/types";
import styles from "../issueDetail.module.scss";
import { ShareIssueModal } from "./ShareIssueModal";

interface OpenPageButtonProps {
  workspaceId: string;
  identifier: string;
}

/**
 * Führt aus Panel und Dialog auf die Vollseite des Issues.
 *
 * Ein Link, kein Knopf mit `router.push`: die Seite ist ein Ort, und den soll
 * man auch mit Cmd-Klick in einem neuen Tab öffnen können. Aussehen und Maße
 * kommen aus `.headerLink` — dieselben wie bei den Ghost-Buttons daneben.
 */
export function OpenPageButton({
  workspaceId,
  identifier,
}: OpenPageButtonProps) {
  const t = useTranslations();
  const label = t("actions.openPage");

  return (
    <Link
      href={issuePath(workspaceId, identifier)}
      className={styles.headerLink}
      aria-label={label}
      title={label}
    >
      <Icon icon="lucide:external-link" width={15} aria-hidden="true" />
    </Link>
  );
}

interface ShareIssueButtonProps {
  issueId: string;
  shareUrl: string | null;
  members: User[];
  me: { id: string };
}

/** Öffnet den Dialog zum Ein-/Ausschalten des öffentlichen Lese-Links —
 *  ohne `issue.share.manage` bleibt der Knopf ganz weg. */
export function ShareIssueButton({
  issueId,
  shareUrl,
  members,
  me,
}: ShareIssueButtonProps) {
  const t = useTranslations();
  const { openModal } = useModal();

  const open = () =>
    openModal(({ close }) => (
      <ShareIssueModal
        issueId={issueId}
        shareUrl={shareUrl}
        members={members}
        me={me}
        close={close}
      />
    ));

  const label = t("share.trigger");

  return (
    <Button
      variant="ghost"
      size="sm"
      icon={<Icon icon="lucide:link" width={15} />}
      aria-label={label}
      title={label}
      onClick={open}
    />
  );
}

interface IssueActionsMenuProps {
  onDelete: () => void;
  /** `issue.access.canDelete` — ohne `issue.delete.any`/`.own` bleibt das Menü weg. */
  canDelete: boolean;
}

/**
 * „…“-Menü der Kopfzeile.
 *
 * Der Weg auf die Vollseite stand hier einmal als Eintrag — er ist jetzt ein
 * eigener Knopf daneben (`OpenPageButton`), und zweimal dieselbe Aktion in
 * derselben Zeile wäre nur Rauschen.
 *
 * Aktuell der einzige Eintrag ist Löschen — ohne `canDelete` bliebe ein Menü
 * mit nichts drin, das rendert das Menü also gleich gar nicht.
 */
export function IssueActionsMenu({
  onDelete,
  canDelete,
}: IssueActionsMenuProps) {
  const t = useTranslations();

  if (!canDelete) return null;

  const items = [
    {
      value: "delete",
      label: t("actions.deleteIssue"),
      icon: <Icon icon="lucide:trash-2" width={15} />,
    },
  ];

  return (
    <InlinePicker
      width={200}
      align="end"
      trigger={
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon icon="lucide:more-horizontal" width={16} />}
          aria-label={t("actions.moreActions")}
          title={t("actions.moreActions")}
        />
      }
    >
      {(close) => (
        <SelectMenu
          items={items}
          value={null}
          onPick={(value) => {
            close();
            if (value === "delete") onDelete();
          }}
          onClose={close}
        />
      )}
    </InlinePicker>
  );
}
