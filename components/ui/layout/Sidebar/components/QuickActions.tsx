"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/atoms/Button/Button";
import { CreateIssueModal } from "@/features/issues/components/CreateIssueModal/CreateIssueModal";
import { usePathname } from "@/i18n/navigation";
import { useModal } from "@/lib/context";
import { useWorkspace } from "@/lib/workspace-context";
import styles from "../sidebar.module.scss";

/** Neue Aufgaben landen im Backlog, sofern der Workspace diesen Status führt. */
const DEFAULT_STATUS = "backlog";

export function QuickActions() {
  const t = useTranslations();
  const { projects, statuses } = useWorkspace();
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

  const openComposer = () => {
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
    <div className={styles.quickActions}>
      <Button
        variant="primary"
        full
        icon={<Icon icon="lucide:plus" width={16} />}
        disabled={!project || !initialStatus}
        onClick={openComposer}
      >
        {t("actions.newIssue")}
      </Button>
      <Button
        variant="outline"
        className={styles.search}
        size="md"
        onClick={() =>
          (window as { __openPalette?: () => void }).__openPalette?.()
        }
      >
        <Icon icon="lucide:search" width={15} />
        <span>{t("placeholders.search")}</span>
        <span className="kbd" style={{ marginLeft: "auto" }}>
          ⌘K
        </span>
      </Button>
    </div>
  );
}
