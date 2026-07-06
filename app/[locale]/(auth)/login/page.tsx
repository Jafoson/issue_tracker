import { redirect } from "next/navigation";
import { enabledOAuthProviders } from "@/auth.config";
import { AuthForm } from "@/features/auth/components/AuthForm/AuthForm";
import { getSession } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  // Bereits eingeloggt? Dann von der Login-Seite weg zur Zielseite.
  // Ohne die Session-Prüfung entstünde eine Redirect-Schleife mit dem Proxy.
  const session = await getSession();
  if (session) redirect(callbackUrl ?? "/");

  return (
    <AuthForm
      mode="login"
      callbackUrl={callbackUrl}
      oauthProviders={enabledOAuthProviders}
    />
  );
}
