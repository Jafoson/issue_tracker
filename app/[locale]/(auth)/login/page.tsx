import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  enabledOAuthProviders,
  oidcIssuerHost,
  oidcProviderName,
} from "@/auth.config";
import { LoginForm } from "@/features/auth/components/LoginForm/LoginForm";
import { isMailConfigured } from "@/lib/mail/send";
import { getSession } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;

  // Bereits eingeloggt? Dann von der Login-Seite weg zur Zielseite.
  // Ohne die Session-Prüfung entstünde eine Redirect-Schleife mit dem Proxy.
  const session = await getSession();
  if (session) redirect(callbackUrl ?? "/");

  // `error` kommt von next-auths eigener Fehler-Weiterleitung
  // (`auth.config.ts`s `pages.error`) — z. B. ein abgelaufener oder schon
  // benutzter Magic-Link-Code, über den Code-Weg auf dieser Seite eingelöst.
  let initialError: string | undefined;
  if (error) {
    const t = await getTranslations("login");
    initialError =
      error === "Verification" ? t("codeInvalid") : t("signInError");
  }

  return (
    <LoginForm
      callbackUrl={callbackUrl}
      oauthProviders={enabledOAuthProviders}
      oidcLabel={oidcProviderName}
      oidcHost={oidcIssuerHost}
      mailConfigured={isMailConfigured()}
      initialError={initialError}
    />
  );
}
