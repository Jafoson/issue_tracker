import { redirect } from "next/navigation";
import { OnboardingForm } from "@/features/onboarding/components/OnboardingForm/OnboardingForm";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      handle: true,
      firstName: true,
      lastName: true,
      onboardedAt: true,
    },
  });
  if (!user) redirect("/login");

  // Schon erledigt (z. B. Zurück-Button nach dem Absenden) — kein Grund, das
  // Formular noch einmal zu zeigen.
  if (user.onboardedAt) redirect("/");

  return (
    <OnboardingForm
      initialHandle={user.handle}
      initialFirstName={user.firstName}
      initialLastName={user.lastName}
    />
  );
}
