"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { generateHandle, pickUserColor } from "@/lib/user-defaults";

type AuthResult = { redirectTo: string } | { error: string };

async function defaultRedirectFor(userId: string): Promise<string> {
  const membership = await db.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true },
  });
  // Locale-freie Pfade – der Client navigiert über next-intl (auto-Präfix).
  return membership ? `/${membership.workspaceId}` : "/create-workspace";
}

export async function login(formData: FormData): Promise<AuthResult> {
  const email =
    (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) return { error: "Email and password are required." };

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError)
      return { error: "Invalid email or password." };
    throw error;
  }

  const callbackUrl = (formData.get("callbackUrl") as string | null) ?? "";
  if (callbackUrl) return { redirectTo: callbackUrl };

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return {
    redirectTo: user ? await defaultRedirectFor(user.id) : "/create-workspace",
  };
}

export async function register(formData: FormData): Promise<AuthResult> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const email =
    (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!name || !email || !password)
    return { error: "All fields are required." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Please enter a valid email address." };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists." };

  const passwordHash = await bcrypt.hash(password, 12);
  const handle = await generateHandle(email);

  try {
    await db.user.create({
      data: { name, handle, email, color: pickUserColor(), passwordHash },
    });
  } catch {
    return { error: "Registration failed. Please try again." };
  }

  // Session über Auth.js etablieren (Credentials-Login mit den frischen Daten).
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
  }

  return { redirectTo: "/create-workspace" };
}

export async function logout(): Promise<void> {
  await signOut({ redirect: true, redirectTo: "/login" });
}

/** OAuth-Login (GitHub/Google). Leitet direkt zum Provider weiter. */
export async function signInWithOAuth(provider: string): Promise<void> {
  await signIn(provider, { redirectTo: "/" });
}
