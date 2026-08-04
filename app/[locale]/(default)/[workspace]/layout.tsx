import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ui/layout/AppShell/AppShell";
import { getCurrentWorkspace } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { canEnterWorkspace } from "@/lib/permissions";
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

  // Eine gültige Session ist noch kein Zutritt: die Workspace-Id steht in der
  // URL, jeder Angemeldete könnte also einen fremden Slug eintippen. `notFound`
  // statt einer Weiterleitung, damit die Existenz des Workspace nicht verrät,
  // wer darin ist. Die Abfragen darunter prüfen zusätzlich selbst — dieses
  // Layout schützt nur die Seiten unter sich.
  if (!(await canEnterWorkspace(session.userId, workspace.id))) notFound();

  return <AppShell>{children}</AppShell>;
}
