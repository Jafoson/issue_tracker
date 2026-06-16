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
    const membership = await db.workspaceMember.findFirst({
      where: { userId: session.userId },
      select: { workspaceId: true },
    });
    if (membership) redirect(`/${locale}/w/${membership.workspaceId}/board`);
    redirect(`/${locale}/create-workspace`);
  }

  return <AuthForm mode="login" locale={locale} />;
}
