import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-secret-minimum-32-characters-long!",
);

const PUBLIC_PATHS = ["/login", "/register"];

async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret);
    return !!payload.sub;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extract locale from first path segment (e.g. /de/... → "de")
  const segments = pathname.split("/").filter(Boolean);
  const locale = segments[0] ?? "de";

  // Skip Next.js internals and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const restPath = `/${segments.slice(1).join("/")}`;
  const isPublic = PUBLIC_PATHS.some(
    (p) => restPath === p || restPath.startsWith(`${p}/`),
  );

  const token = request.cookies.get("session")?.value;
  const valid = await isValidSession(token);

  if (!valid && !isPublic) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
