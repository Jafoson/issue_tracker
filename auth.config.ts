import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

// Edge-sichere Basiskonfiguration (KEIN Prisma-Adapter, KEIN bcrypt) — wird sowohl
// vom vollen Node-Setup (auth.ts) als auch vom Middleware-Gate (proxy.ts) genutzt.
// Der Credentials-Provider + Adapter kommen erst in auth.ts dazu.

// OAuth-Provider nur aktivieren, wenn die zugehörigen Env-Vars gesetzt sind.
// So läuft die App auch ohne konfiguriertes OAuth (nur E-Mail/Passwort).
const oauthProviders: NextAuthConfig["providers"] = [];
export const enabledOAuthProviders: string[] = [];
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  oauthProviders.push(GitHub);
  enabledOAuthProviders.push("github");
}
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  oauthProviders.push(Google);
  enabledOAuthProviders.push("google");
}

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: oauthProviders,
  callbacks: {
    // User-Id + globale Rolle + Avatar-Farbe in das JWT übernehmen (bei Login liegt `user` vor).
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      if (user) {
        token.globalRole = user.globalRole ?? "member";
        token.color = user.color;
      }
      return token;
    },
    // Id + globale Rolle + Farbe aus dem Token in die Session spiegeln (serverseitig verfügbar).
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      session.user.globalRole = (token.globalRole as string) ?? "member";
      session.user.color = (token.color as string) ?? "var(--primary)";
      return session;
    },
  },
} satisfies NextAuthConfig;
