import "server-only";
import { auth } from "@/auth";

// Dünner Wrapper über Auth.js `auth()`. Behält die bisherige `{ userId }`-Form bei,
// damit Pages/Layouts und lib/permissions.ts unverändert bleiben.
export async function getSession(): Promise<{ userId: string } | null> {
  const session = await auth();
  return session?.user?.id ? { userId: session.user.id } : null;
}
