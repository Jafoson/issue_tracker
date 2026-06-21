import { notFound, redirect } from "next/navigation";
import {
  listGrantableUsers,
  listPlatformAdmins,
  listWorkspacesForAdmin,
} from "@/features/platform";
import { AdminDashboard } from "@/features/platform/components/AdminDashboard/AdminDashboard";
import { hasLocale } from "@/lib/i18n";
import { currentUserIsPlatformAdmin } from "@/lib/platform";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PlatformAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  // Existenz des Panels verbergen: Nicht-Admins bekommen 404 statt einer
  // "Zugriff verweigert"-Seite.
  if (!(await currentUserIsPlatformAdmin())) notFound();

  const [workspaces, admins, grantable] = await Promise.all([
    listWorkspacesForAdmin(),
    listPlatformAdmins(),
    listGrantableUsers(),
  ]);

  return (
    <AdminDashboard
      locale={locale}
      workspaces={workspaces}
      admins={admins}
      grantable={grantable}
    />
  );
}
