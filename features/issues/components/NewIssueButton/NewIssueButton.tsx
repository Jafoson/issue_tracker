"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/atoms/Button/Button";
import { CreateIssueModal } from "@/features/issues/components/CreateIssueModal/CreateIssueModal";
import type { IssueComposerData } from "@/features/issues/types";
import { usePathname } from "@/i18n/navigation";
import { useModal } from "@/lib/context";

/** New tasks land in the backlog, provided the workspace has that status. */
const DEFAULT_STATUS = "backlog";

interface NewIssueButtonProps {
  data: IssueComposerData;
}

/**
 * Opens the `CreateIssueModal`. The data comes as props from the server
 * component above — only the route-dependent project choice stays here,
 * because it needs `usePathname()`.
 *
 * Without `issue.create` in any project, the button doesn't exist. It
 * would otherwise be an invitation into a dialog that ends up rejected —
 * the action re-checks this itself anyway.
 */
export function NewIssueButton({ data }: NewIssueButtonProps) {
  const { projects, statuses, creatableProjectIds } = data;
  const t = useTranslations();
  const { openModal } = useModal();
  const pathname = usePathname();

  const creatable = projects.filter((p) => creatableProjectIds.includes(p.id));

  // On a project route (/<workspace>/project/<slug>/…), preselect the
  // currently open project — but only if creation is allowed there.
  // Otherwise the first allowed one. It can still be switched within the
  // modal itself.
  const activeSlug = pathname.match(/\/project\/([^/]+)/)?.[1];
  const project = creatable.find((p) => p.slug === activeSlug) ?? creatable[0];

  // Workspaces can have their own status lists — without "backlog", the first one.
  const initialStatus =
    statuses.find((s) => s.id === DEFAULT_STATUS)?.id ?? statuses[0]?.id;

  if (!project || !initialStatus) return null;

  const open = () =>
    openModal(({ close }) => (
      <CreateIssueModal
        projectId={project.id}
        initialStatus={initialStatus}
        data={data}
        close={close}
      />
    ));

  return (
    <Button
      variant="primary"
      full
      icon={<Icon icon="lucide:plus" width={16} />}
      onClick={open}
    >
      {t("actions.newIssue")}
    </Button>
  );
}
