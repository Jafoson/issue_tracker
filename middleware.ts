import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sessionSecret } from "@/lib/session-secret";

const PUBLIC_PATHS = ["/login", "/register"];

async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, sessionSecret);
    return !!payload.sub;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const segments = pathname.split("/").filter(Boolean);
  const locale = segments[0] ?? "de";
  const restPath = `/${segments.slice(1).join("/")}`;

  const isPublic = PUBLIC_PATHS.some(
    (p) => restPath === p || restPath.startsWith(`${p}/`),
  );

  const token = request.cookies.get("session")?.value;
  const valid = await isValidSession(token);

  if (!valid && !isPublic) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
