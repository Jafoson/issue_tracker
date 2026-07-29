import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ui/layout/AppShell/AppShell";
import { getCurrentWorkspace } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { locale, workspace: workspaceId } = await params;

  // Aktive Workspace-ID request-scoped ablegen, damit verschachtelte Server
  // Components sie via getCurrentWorkspace() lesen können (analog zur Session).
  setCurrentWorkspaceId(workspaceId);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const workspace = await getCurrentWorkspace();
  if (!workspace) notFound();

  return <AppShell>{children}</AppShell>;
}
