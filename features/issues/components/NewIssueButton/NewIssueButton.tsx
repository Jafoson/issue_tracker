"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/atoms/Button/Button";
import { CreateIssueModal } from "@/features/issues/components/CreateIssueModal/CreateIssueModal";
import type { IssueComposerData } from "@/features/issues/types";
import { usePathname } from "@/i18n/navigation";
import { useModal } from "@/lib/context";

/** Neue Aufgaben landen im Backlog, sofern der Workspace diesen Status führt. */
const DEFAULT_STATUS = "backlog";

interface NewIssueButtonProps {
  data: IssueComposerData;
}

/**
 * Öffnet das `CreateIssueModal`. Die Daten kommen als Props von der Server
 * Component darüber — nur die routenabhängige Projektwahl bleibt hier, weil
 * sie `usePathname()` braucht.
 *
 * Ohne `issue.create` in irgendeinem Projekt gibt es den Knopf nicht. Er wäre
 * sonst eine Einladung in einen Dialog, der am Ende abgewiesen wird — die
 * Action prüft ohnehin noch einmal selbst.
 */
export function NewIssueButton({ data }: NewIssueButtonProps) {
  const { projects, statuses, creatableProjectIds } = data;
  const t = useTranslations();
  const { openModal } = useModal();
  const pathname = usePathname();

  const creatable = projects.filter((p) => creatableProjectIds.includes(p.id));

  // Auf einer Projektroute (/<workspace>/project/<slug>/…) das geöffnete
  // Projekt vorbelegen — aber nur, wenn dort etwas entstehen darf. Sonst das
  // erste erlaubte. Im Modal selbst lässt es sich weiter umschalten.
  const activeSlug = pathname.match(/\/project\/([^/]+)/)?.[1];
  const project = creatable.find((p) => p.slug === activeSlug) ?? creatable[0];

  // Workspaces können eigene Statuslisten haben — ohne "backlog" der erste.
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
