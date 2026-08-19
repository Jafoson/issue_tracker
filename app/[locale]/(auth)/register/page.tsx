import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * Eine eigene Registrierung gibt es nicht mehr — E-Mail eintippen und einen
 * Passkey anlegen ist auf `/login` zugleich Anmeldung und Kontoerstellung
 * (`next-auth/webauthn` entscheidet serverseitig, welches von beidem
 * zutrifft). Diese Route bleibt nur als Weiterleitung für alte Links.
 */
export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { locale } = await params;
  const { callbackUrl } = await searchParams;

  redirect({
    href: callbackUrl
      ? { pathname: "/login", query: { callbackUrl } }
      : "/login",
    locale: locale as Locale,
  });
}
