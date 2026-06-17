import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { AuthForm } from "@/features/auth/components/AuthForm/AuthForm";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const session = await getSession();
  if (session) {
    const user = await db.user.findUnique({ where: { id: session.userId }, select: { id: true } });
    if (!user) redirect(`/api/logout?to=/${locale}/login`);

    const membership = await db.workspaceMember.findFirst({
      where: { userId: session.userId },
      select: { workspaceId: true },
    });
    if (membership) redirect(`/${locale}/${membership.workspaceId}`);
    redirect(`/${locale}/create-workspace`);
  }

  return <AuthForm mode="login" locale={locale} />;
}
