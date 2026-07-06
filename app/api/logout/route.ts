import { signOut } from "@/auth";

// Serverseitiger Logout-Endpunkt. Wird u.a. genutzt, um eine veraltete Session
// (gültiges JWT, aber User nicht mehr in der DB) zu bereinigen und so eine
// Redirect-Schleife mit dem Proxy zu vermeiden. `?to=` steuert das Ziel.
export async function GET(request: Request) {
  const to = new URL(request.url).searchParams.get("to") ?? "/de/login";
  return signOut({ redirectTo: to });
}
