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
 * Leads from the panel and dialog to the issue's full page.
 *
 * A link, not a button with `router.push`: the page is a place, and it
 * should be possible to open it with a Cmd-click in a new tab too.
 * Appearance and dimensions come from `.headerLink` — the same as the ghost
 * buttons next to it.
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

/** Opens the dialog for enabling/disabling the public read-only link —
 *  without `issue.share.manage` the button is left out entirely. */
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
  /** `issue.access.canDelete` — without `issue.delete.any`/`.own` the menu is left out. */
  canDelete: boolean;
}

/**
 * The "…" menu in the header.
 *
 * The link to the full page used to be an entry here — it's now its own
 * button next to it (`OpenPageButton`), and having the same action twice in
 * the same row would just be noise.
 *
 * Currently the only entry is delete — without `canDelete` the menu would
 * be left with nothing in it, so it isn't rendered at all in that case.
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
