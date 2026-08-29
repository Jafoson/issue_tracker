import { signOut } from "@/auth";

// Server-side logout endpoint. Used, among other things, to clean up a stale
// session (valid JWT, but the user no longer exists in the DB) and thereby
// avoid a redirect loop with the proxy. `?to=` controls the destination.
export async function GET(request: Request) {
  const to = new URL(request.url).searchParams.get("to") ?? "/de/login";
  return signOut({ redirectTo: to });
}
