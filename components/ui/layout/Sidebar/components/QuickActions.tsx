import { NewIssueButton } from "@/features/issues/components/NewIssueButton/NewIssueButton";
import {
  getWorkspaceProjects,
  getWorkspaceStatuses,
} from "@/features/workspaces/queries";
import styles from "../sidebar.module.scss";
import { SearchButton } from "./SearchButton";

export async function QuickActions() {
  const [projects, statuses] = await Promise.all([
    getWorkspaceProjects(),
    getWorkspaceStatuses(),
  ]);

  return (
    <div className={styles.quickActions}>
      <NewIssueButton projects={projects} statuses={statuses} />
      <SearchButton />
    </div>
  );
}
