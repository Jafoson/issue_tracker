"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/atoms/Button/Button";
import { CreateProjectModal } from "@/features/projects/components/CreateProjectModal/CreateProjectModal";
import { useModal } from "@/lib/context";

interface NewProjectButtonProps {
  workspaceId: string;
  /** Just the plus icon, for tight spots like the sidebar heading. */
  compact?: boolean;
}

/**
 * Opens the `CreateProjectModal`. A dedicated Client Component so Server
 * Components (sidebar navigation, project list) can use the button without
 * becoming Client Components themselves.
 */
export function NewProjectButton({
  workspaceId,
  compact = false,
}: NewProjectButtonProps) {
  const t = useTranslations();
  const { openModal } = useModal();

  const open = () =>
    openModal(({ close }) => (
      <CreateProjectModal workspaceId={workspaceId} close={close} />
    ));

  if (compact) {
    return (
      <Button
        variant="text"
        icon={<Icon icon="lucide:plus" width={15} />}
        aria-label={t("actions.newProject")}
        title={t("actions.newProject")}
        onClick={open}
      />
    );
  }

  return (
    <Button
      variant="primary"
      icon={<Icon icon="lucide:plus" width={15} />}
      onClick={open}
    >
      {t("actions.newProject")}
    </Button>
  );
}
