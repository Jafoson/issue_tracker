import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasLocale } from "@/lib/i18n";
import { getSession } from "@/lib/session";

export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true },
  });
  if (!user) redirect(`/api/logout?to=/${locale}/login`);

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.userId },
    select: { workspaceId: true },
  });

  if (membership) redirect(`/${locale}/${membership.workspaceId}`);
  redirect(`/${locale}/create-workspace`);
}
