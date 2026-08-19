import { redirect } from "next/navigation";
import { VerifyCodeForm } from "@/features/auth/components/VerifyCodeForm/VerifyCodeForm";
import { db } from "@/lib/db";
import { isMailConfigured } from "@/lib/mail/send";
import { getSession } from "@/lib/session";

export default async function VerifyCodePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; callbackUrl?: string }>;
}) {
  const { email, callbackUrl } = await searchParams;
  const session = await getSession();

  if (session) {
    // Nur weg von hier, wenn die Sitzung schon zu genau diesem Konto gehört
    // — sonst käme man nie zum Code, wenn man gerade als jemand anderes
    // eingeloggt ist. Genau das passiert beim Einladungs-Flow: die eigene
    // Sitzung ist noch aktiv, der Code gehört aber zum eingeladenen Konto.
    // Die Verifizierung selbst (`/api/auth/callback/nodemailer`) tauscht die
    // Sitzung danach korrekt aus, unabhängig davon, wer vorher eingeloggt war.
    const target = email
      ? await db.user.findUnique({ where: { email }, select: { id: true } })
      : null;
    if (!email || target?.id === session.userId) {
      redirect(callbackUrl ?? "/");
    }
  }

  // Ohne E-Mail (direkter Aufruf, alter Bookmark) oder ohne SMTP gibt es
  // nichts zu verifizieren — zurück zum Anfang des Login-Formulars.
  if (!email || !isMailConfigured()) redirect("/login");

  return <VerifyCodeForm email={email} callbackUrl={callbackUrl} />;
}
