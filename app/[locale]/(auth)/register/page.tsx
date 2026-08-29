import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * A dedicated registration flow no longer exists — typing an email and
 * creating a passkey on `/login` is simultaneously sign-in and account
 * creation (`next-auth/webauthn` decides server-side which of the two
 * applies). This route remains only as a redirect for old links.
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
