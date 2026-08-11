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
    // User-Id + Avatar-Farbe + Name in das JWT übernehmen (bei Login liegt `user` vor).
    //
    // Die Rolle gehört bewusst NICHT ins Token: ein JWT lebt bis zum nächsten
    // Login, eine Rollenänderung würde also erst verspätet greifen. Rechte
    // werden in `lib/permissions.ts` bei jeder Prüfung frisch aus der Datenbank
    // aufgelöst — das Token trägt nur Anzeigedaten.
    //
    // `trigger === "update"` ist der zweite Weg hinein: die eigenen
    // Einstellungen ändern Name und Farbe, und das Token lebt bis zum nächsten
    // Login. Ohne diesen Zweig stünde im Menü unten links noch tagelang der alte
    // Name — angezeigt wird ja das Token, nicht die Datenbank. Übernommen werden
    // nur diese drei Felder: was `unstable_update` sonst mitschickt, ist
    // Eingabe aus dem Browser und hat in einem Token nichts verloren.
    jwt({ token, user, trigger, session }) {
      if (user?.id) token.id = user.id;
      if (user) {
        token.color = user.color;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
      }

      if (trigger === "update" && session && typeof session === "object") {
        const next = (session as { user?: Record<string, unknown> }).user;
        if (typeof next?.color === "string") token.color = next.color;
        if (typeof next?.firstName === "string")
          token.firstName = next.firstName;
        if (typeof next?.lastName === "string") token.lastName = next.lastName;
      }

      return token;
    },
    // Id + Farbe + Name aus dem Token in die Session spiegeln (serverseitig verfügbar).
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      session.user.color = (token.color as string) ?? "var(--primary)";
      session.user.firstName = (token.firstName as string) ?? "";
      session.user.lastName = (token.lastName as string) ?? "";
      return session;
    },
  },
} satisfies NextAuthConfig;
