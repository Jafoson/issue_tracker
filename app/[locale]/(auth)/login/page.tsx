import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/components/AuthForm/AuthForm";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  if (callbackUrl) redirect(callbackUrl);

  return <AuthForm mode="login" callbackUrl={callbackUrl} />;
}
