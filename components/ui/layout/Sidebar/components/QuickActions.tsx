import { NewIssueButton } from "@/features/issues/components/NewIssueButton/NewIssueButton";
import { getIssueComposerData } from "@/features/issues/editor-data";
import styles from "../sidebar.module.scss";
import { SearchButton } from "./SearchButton";

export async function QuickActions() {
  const composerData = await getIssueComposerData();

  return (
    <div className={styles.quickActions}>
      {composerData && <NewIssueButton data={composerData} />}
      <SearchButton />
    </div>
  );
}
