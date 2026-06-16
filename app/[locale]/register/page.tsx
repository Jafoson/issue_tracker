import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AuthForm } from "@/features/auth/components/AuthForm/AuthForm";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const session = await getSession();
  if (session) redirect(`/${locale}/create-workspace`);

  return <AuthForm mode="register" locale={locale} />;
}
