import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ui/layout/AppShell/AppShell";
import { loadWorkspaceData } from "@/features/issues/queries";
import { getStaticMessages, hasLocale } from "@/lib/i18n";
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
  if (!hasLocale(locale)) notFound();

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const [data, messages] = await Promise.all([
    loadWorkspaceData(workspaceId, session.userId),
    getStaticMessages(locale),
  ]);
  if (!data) notFound();

  return (
    <AppShell messages={messages} workspace={data}>
      {children}
    </AppShell>
  );
}
