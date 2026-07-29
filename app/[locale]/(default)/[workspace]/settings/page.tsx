import { notFound } from "next/navigation";
import { Settings } from "@/features/admin/components/Settings/Settings";
import { getMe, getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const [me, projects] = await Promise.all([getMe(), getWorkspaceProjects()]);
  if (!me) notFound();

  return <Settings me={me} projects={projects} />;
}
