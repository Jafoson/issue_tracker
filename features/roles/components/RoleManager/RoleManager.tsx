import { RoleManagerView } from "@/features/roles/components/RoleManagerView/RoleManagerView";
import { getRoleManagerView } from "@/features/roles/queries";
import type { RoleTarget } from "@/features/roles/types";

interface Props {
  target: RoleTarget;
  title: string;
  subtitle: string;
  /** On pages with a tab switcher, the title is already on the tab. */
  showTitle?: boolean;
}

/**
 * Server part of the role editor: loads the pool and passes it on.
 *
 * The same component serves all three scopes — the three routes differ
 * only in their `target` and their texts.
 */
export async function RoleManager({
  target,
  title,
  subtitle,
  showTitle,
}: Props) {
  const view = await getRoleManagerView(target);
  return (
    <RoleManagerView
      view={view}
      title={title}
      subtitle={subtitle}
      showTitle={showTitle}
    />
  );
}
