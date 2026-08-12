import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { touchLastSeen } from "@/lib/presence";
import { DEFAULT_PLATFORM_ROLE_KEY, systemRoleId } from "@/lib/rbac";
import { generateHandle, pickUserColor } from "@/lib/user-defaults";
import { splitName } from "@/lib/utils/string";

// PrismaAdapter mit createUser-Override: OAuth-User liefern nur name/email/image,
// aber `handle` und `color` sind NOT NULL. Der volle OAuth-Name kommt als ein Feld
// vom Provider und wird für unser firstName/lastName-Schema aufgesplittet.
function createAdapter(): Adapter {
  const base = PrismaAdapter(db);
  return {
    ...base,
    async createUser({ id: _id, ...data }: AdapterUser) {
      const { firstName, lastName } = splitName(
        data.name ?? data.email ?? "User",
      );
      const handle = await generateHandle(data.email ?? data.name ?? "user");
      const user = await db.user.create({
        data: {
          firstName,
          lastName,
          email: data.email,
          emailVerified: data.emailVerified,
          image: data.image,
          handle,
          color: pickUserColor(),
          // Jedes neue Konto startet ohne Plattform-Rechte.
          platformRoleId: systemRoleId("PLATFORM", DEFAULT_PLATFORM_ROLE_KEY),
        },
      });
      return user as AdapterUser;
    },
  };
}

// `unstable_update` schreibt das JWT neu, ohne dass sich jemand neu anmelden
// muss — gebraucht von den eigenen Einstellungen, wenn Name oder Farbe sich
// ändern (siehe den `update`-Zweig im jwt-Callback in `auth.config.ts`). Der
// Name ist der von Auth.js; instabil ist daran die Bezeichnung, nicht die
// Wirkung.
export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Der zweite Eingang: OAuth.
     *
     * Der Credentials-Provider prüft und protokolliert in seinem `authorize`;
     * ein Anbieter-Login läuft daran vorbei und käme sonst auch mit einem
     * stillgelegten Konto herein. Die Prüfung steht hier statt in
     * `auth.config.ts`, weil dort kein Prisma laufen darf — die Datei wird auch
     * vom Middleware-Gate geladen.
     */
    async signIn({ user, account }) {
      if (!user.id) return true;

      const row = await db.user.findUnique({
        where: { id: user.id },
        select: { deactivatedAt: true },
      });
      if (row?.deactivatedAt) {
        await recordAudit({
          action: "auth.login.failed",
          actorId: user.id,
          meta: { reason: "deactivated", provider: account?.provider ?? null },
        });
        return false;
      }

      // Credentials hat seinen Eintrag schon geschrieben — hier käme er doppelt.
      if (account?.provider && account.provider !== "credentials") {
        await Promise.all([
          recordAudit({
            action: "auth.login",
            actorId: user.id,
            meta: { provider: account.provider },
          }),
          touchLastSeen(user.id),
        ]);
      }

      return true;
    },
  },
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
        if (!user?.passwordHash) {
          await recordAudit({
            action: "auth.login.failed",
            actorLabel: email,
            meta: { reason: "unknown-account", provider: "credentials" },
          });
          return null;
        }

        const passwordOk = await bcrypt.compare(password, user.passwordHash);
        if (!passwordOk) {
          // Die Id steht dabei, das Passwort nirgends — auch nicht als Länge
          // oder Prüfsumme. Was einer getippt hat, geht das Protokoll nichts an.
          await recordAudit({
            action: "auth.login.failed",
            actorId: user.id,
            meta: { reason: "wrong-password", provider: "credentials" },
          });
          return null;
        }

        // Stillgelegte Konten kommen nicht herein. Die Rechteauflösung würde
        // ihnen zwar nichts geben (`lib/permissions.ts`), aber eine Sitzung, die
        // auf jeder Seite ins Leere greift, ist keine brauchbare Antwort auf
        // „dieses Konto ist gesperrt".
        if (user.deactivatedAt) {
          await recordAudit({
            action: "auth.login.failed",
            actorId: user.id,
            meta: { reason: "deactivated", provider: "credentials" },
          });
          return null;
        }

        await Promise.all([
          recordAudit({
            action: "auth.login",
            actorId: user.id,
            meta: { provider: "credentials" },
          }),
          touchLastSeen(user.id),
        ]);

        return {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          image: user.image,
          color: user.color,
        };
      },
    }),
  ],
});
