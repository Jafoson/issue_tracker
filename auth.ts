import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { generateHandle, pickUserColor } from "@/lib/user-defaults";
import type { User as AppUser } from "@/types/user";

// PrismaAdapter mit createUser-Override: OAuth-User liefern nur name/email/image,
// aber `handle` und `color` sind NOT NULL. Wir ergänzen sie hier (wie beim Register).
function createAdapter(): Adapter {
  const base = PrismaAdapter(db);
  return {
    ...base,
    async createUser({ id: _id, ...data }: AdapterUser) {
      const handle = await generateHandle(data.email ?? data.name ?? "user");
      const user = await db.user.create({
        data: {
          name: data.name ?? data.email ?? "User",
          email: data.email,
          emailVerified: data.emailVerified,
          image: data.image,
          handle,
          color: pickUserColor(),
        },
      });
      return user as AdapterUser;
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: createAdapter(),
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // Domain-User (types/user.ts) zurückgeben; isPlatformAdmin ergänzen, damit
        // die globale Plattform-Rolle ins JWT/die Session wandert.
        const authUser: AppUser & { isPlatformAdmin: boolean } = {
          id: user.id,
          name: user.name,
          email: user.email,
          color: user.color,
          image: user.image ?? undefined,
          isPlatformAdmin: user.isPlatformAdmin,
        };
        return authUser;
      },
    }),
  ],
});
