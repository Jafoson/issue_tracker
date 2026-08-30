import "server-only";
import { auth } from "@/auth";

// Thin wrapper over Auth.js's `auth()`. Keeps the previous `{ userId }`
// shape so pages/layouts and lib/permissions.ts stay unchanged.
export async function getSession(): Promise<{ userId: string } | null> {
  const session = await auth();
  return session?.user?.id ? { userId: session.user.id } : null;
}
