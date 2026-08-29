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
    // Only navigate away from here if the session already belongs to exactly
    // this account — otherwise you'd never reach the code screen while
    // signed in as someone else. That's exactly what happens in the
    // invitation flow: your own session is still active, but the code
    // belongs to the invited account. Verification itself
    // (`/api/auth/callback/nodemailer`) correctly swaps the session
    // afterward, regardless of who was signed in before.
    const target = email
      ? await db.user.findUnique({ where: { email }, select: { id: true } })
      : null;
    if (!email || target?.id === session.userId) {
      redirect(callbackUrl ?? "/");
    }
  }

  // Without an email (direct call, old bookmark) or without SMTP, there's
  // nothing to verify — back to the start of the login form.
  if (!email || !isMailConfigured()) redirect("/login");

  return <VerifyCodeForm email={email} callbackUrl={callbackUrl} />;
}
