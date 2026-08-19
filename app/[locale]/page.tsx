import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Locale-Validierung übernimmt app/[locale]/layout.tsx (hasLocale → notFound).
  const { locale } = await params;

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, onboardedAt: true },
  });
  if (!user) redirect(`/api/logout?to=/${locale}/login`);

  // Frisch selbst angemeldet (Passkey/Magic Link/OAuth), noch kein Konto
  // eingerichtet — eingeladene Konten haben das schon bei der Einladung
  // erledigt bekommen (`onboardedAt` dort sofort gesetzt).
  if (!user.onboardedAt) redirect(`/${locale}/onboarding`);

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.userId },
    select: { workspaceId: true },
  });

  if (membership) redirect(`/${locale}/${membership.workspaceId}`);
  redirect(`/${locale}/create-workspace`);
}
