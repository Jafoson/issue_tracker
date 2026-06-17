"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, clearSession } from "@/lib/session";

type AuthResult = { redirectTo: string } | { error: string };

export async function login(formData: FormData): Promise<AuthResult> {
  const email    = (formData.get("email")    as string | null)?.trim().toLowerCase() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) return { error: "Email and password are required." };

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) return { error: "Invalid email or password." };

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: "Invalid email or password." };

  await createSession(user.id);

  const callbackUrl = (formData.get("callbackUrl") as string | null) ?? "";
  if (callbackUrl) return { redirectTo: callbackUrl };

  const membership = await db.workspaceMember.findFirst({
    where: { userId: user.id },
    select: { workspaceId: true },
  });

  const locale = (formData.get("locale") as string | null) ?? "de";
  if (membership) return { redirectTo: `/${locale}/${membership.workspaceId}` };
  return { redirectTo: `/${locale}/create-workspace` };
}

export async function register(formData: FormData): Promise<AuthResult> {
  const name     = (formData.get("name")     as string | null)?.trim() ?? "";
  const email    = (formData.get("email")    as string | null)?.trim().toLowerCase() ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  const locale   = (formData.get("locale")   as string | null) ?? "de";

  if (!name || !email || !password) return { error: "All fields are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address." };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists." };

  const passwordHash = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();

  const baseHandle = email.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 12) || "user";
  let handle = baseHandle;
  let suffix = 1;
  while (await db.user.findUnique({ where: { handle } })) {
    handle = `${baseHandle}${suffix++}`;
  }

  const colors = ["#6e63e6", "#3b9d6e", "#d5733b", "#3b7bd5", "#c2456b", "#a05fd0", "#cf9a3b"];
  const color = colors[Math.floor(Math.random() * colors.length)];

  try {
    await db.user.create({ data: { id, name, handle, email, color, passwordHash } });
  } catch {
    return { error: "Registration failed. Please try again." };
  }

  await createSession(id);
  return { redirectTo: `/${locale}/create-workspace` };
}

export async function logout(): Promise<void> {
  await clearSession();
}
