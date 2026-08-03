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

  // Der Plattform-Bereich hängt am Scope PLATFORM. `notFound` statt einer
  // Weiterleitung, damit die Existenz des Bereichs nicht verrät, wer ihn sehen
  // darf. Jede Unterseite lädt zusätzlich ihre eigenen Daten erst nach dieser
  // Prüfung — Layouts allein sind kein Schutz für Server Actions.
  const access = await getAccess(PLATFORM);
  if (!access.has("platform.access")) notFound();

  return <AppShell isAdminRoute>{children}</AppShell>;
}
