import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ui/layout/AppShell/AppShell";
import { getAccess, PLATFORM } from "@/lib/permissions";
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

  // The platform section is gated on the PLATFORM scope. `notFound` instead of
  // a redirect, so the section's existence doesn't reveal who is allowed to
  // see it. Every subpage additionally loads its own data only after this
  // check — layouts alone are not protection for Server Actions.
  const access = await getAccess(PLATFORM);
  if (!access.has("platform.access")) notFound();

  return <AppShell isAdminRoute>{children}</AppShell>;
}
