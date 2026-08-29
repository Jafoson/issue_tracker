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

  // Already done (e.g. back button after submitting) — no reason to show
  // the form again.
  if (user.onboardedAt) redirect("/");

  return (
    <OnboardingForm
      initialHandle={user.handle}
      initialFirstName={user.firstName}
      initialLastName={user.lastName}
    />
  );
}
