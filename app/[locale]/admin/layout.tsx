import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ui/layout/AppShell/AppShell";
import { getFirstWorkspaceId } from "@/features/admin/queries";
import {
  getIsPlatformAdmin,
  loadWorkspaceData,
} from "@/features/issues/queries";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Plattform-Ebene: steht über allen Workspaces, nur für globale Plattform-Admins.
// Nutzt dieselbe AppShell wie der Workspace-Bereich (gleiche Sidebar, Topbar,
// Tabs, Context) — der Context wird mit dem ersten Workspace des Users gefüllt.
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const isPlatformAdmin = await getIsPlatformAdmin(session.userId);
  if (!isPlatformAdmin) notFound();

  const firstWorkspaceId = await getFirstWorkspaceId(session.userId);
  if (!firstWorkspaceId) redirect(`/${locale}/create-workspace`);

  const data = await loadWorkspaceData(firstWorkspaceId, session.userId);
  if (!data) notFound();

  return <AppShell workspace={data}>{children}</AppShell>;
}
