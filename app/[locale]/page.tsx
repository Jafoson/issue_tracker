import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { hasLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.userId },
    select: { workspaceId: true },
  });

  if (membership) redirect(`/${locale}/w/${membership.workspaceId}/board`);
  redirect(`/${locale}/create-workspace`);
}
