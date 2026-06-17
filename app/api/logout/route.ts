import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function GET(request: Request) {
  await clearSession();
  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to") ?? "/de/login";
  return NextResponse.redirect(new URL(to, request.url));
}
