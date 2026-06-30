import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { sessionSecret } from "@/lib/session-secret";

// Öffentliche Seiten (ohne Locale-Präfix), die ohne gültige Session erreichbar sind.
const PUBLIC_PATHS = ["/login", "/register"];

const handleI18nRouting = createMiddleware(routing);

async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, sessionSecret);
    return !!payload.sub;
  } catch {
    return false;
  }
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Locale-Präfix abtrennen, um öffentliche Pfade locale-unabhängig zu prüfen.
  const segments = pathname.split("/").filter(Boolean);
  const hasLocalePrefix = (routing.locales as readonly string[]).includes(
    segments[0],
  );
  const restPath = hasLocalePrefix
    ? `/${segments.slice(1).join("/")}`
    : pathname;

  const isPublic = PUBLIC_PATHS.some(
    (p) => restPath === p || restPath.startsWith(`${p}/`),
  );

  // Auth-Gate: geschützte Route ohne gültige Session → zum Login umleiten.
  if (!isPublic) {
    const token = request.cookies.get("session")?.value;
    if (!(await isValidSession(token))) {
      const locale = hasLocalePrefix ? segments[0] : routing.defaultLocale;
      const loginUrl = new URL(`/${locale}/login`, request.url);
      // callbackUrl ohne Locale-Präfix – der Client navigiert über next-intl,
      // das die aktive Locale automatisch ergänzt.
      loginUrl.searchParams.set("callbackUrl", restPath);
      return NextResponse.redirect(loginUrl);
    }
  }

  // next-intl übernimmt das Locale-Routing (z.B. /login → /de/login) und setzt
  // die nötigen Locale-Header für die nachgelagerten Server Components.
  return handleI18nRouting(request);
}

export const config = {
  // Auf allen Pfaden laufen, außer API-Routen, Next.js-Internals und Dateien mit
  // Endung (z.B. favicon.ico). Entspricht der next-intl-Empfehlung.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
