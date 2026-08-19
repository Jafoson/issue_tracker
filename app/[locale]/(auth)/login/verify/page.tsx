import { redirect } from "next/navigation";
import { VerifyCodeForm } from "@/features/auth/components/VerifyCodeForm/VerifyCodeForm";
import { isMailConfigured } from "@/lib/mail/send";
import { getSession } from "@/lib/session";

export default async function VerifyCodePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; callbackUrl?: string }>;
}) {
  const { email, callbackUrl } = await searchParams;

  // Bereits eingeloggt? Dann von der Login-Seite weg zur Zielseite.
  const session = await getSession();
  if (session) redirect(callbackUrl ?? "/");

  // Ohne E-Mail (direkter Aufruf, alter Bookmark) oder ohne SMTP gibt es
  // nichts zu verifizieren — zurück zum Anfang des Login-Formulars.
  if (!email || !isMailConfigured()) redirect("/login");

  return <VerifyCodeForm email={email} callbackUrl={callbackUrl} />;
}
