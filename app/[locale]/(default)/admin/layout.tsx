import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/layout/AppShell/AppShell";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  return <AppShell isAdminRoute>{children}</AppShell>;
}
