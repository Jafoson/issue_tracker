"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/atoms/Button/Button";
import { CreateIssueModal } from "@/features/issues/components/CreateIssueModal/CreateIssueModal";
import { usePathname } from "@/i18n/navigation";
import { useModal } from "@/lib/context";
import type { Project, Status } from "@/types";

/** Neue Aufgaben landen im Backlog, sofern der Workspace diesen Status führt. */
const DEFAULT_STATUS = "backlog";

interface NewIssueButtonProps {
  projects: Project[];
  statuses: Status[];
}

/**
 * Öffnet das `CreateIssueModal`. Die Daten kommen als Props von der Server
 * Component darüber — nur die routenabhängige Projektwahl bleibt hier, weil
 * sie `usePathname()` braucht.
 */
export function NewIssueButton({ projects, statuses }: NewIssueButtonProps) {
  const t = useTranslations();
  const { openModal } = useModal();
  const pathname = usePathname();

  // Auf einer Projektroute (/<workspace>/project/<slug>/…) das geöffnete
  // Projekt vorbelegen, sonst das erste des Workspace. Im Modal selbst lässt es
  // sich weiter umschalten.
  const activeSlug = pathname.match(/\/project\/([^/]+)/)?.[1];
  const project = projects.find((p) => p.slug === activeSlug) ?? projects[0];

  // Workspaces können eigene Statuslisten haben — ohne "backlog" der erste.
  const initialStatus =
    statuses.find((s) => s.id === DEFAULT_STATUS)?.id ?? statuses[0]?.id;

  const open = () => {
    if (!project || !initialStatus) return;
    openModal(({ close }) => (
      <CreateIssueModal
        projectId={project.id}
        initialStatus={initialStatus}
        close={close}
      />
    ));
  };

  return (
    <Button
      variant="primary"
      full
      icon={<Icon icon="lucide:plus" width={16} />}
      disabled={!project || !initialStatus}
      onClick={open}
    >
      {t("actions.newIssue")}
    </Button>
  );
}
