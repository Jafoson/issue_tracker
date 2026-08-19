import { randomInt } from "node:crypto";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import Nodemailer from "next-auth/providers/nodemailer";
import WebAuthn from "next-auth/providers/webauthn";
import { authConfig } from "@/auth.config";
import { appBaseUrl } from "@/lib/app-url";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { isMailConfigured, sendMail } from "@/lib/mail/send";
import { magicLinkEmail } from "@/lib/mail/templates/magicLink";
import { touchLastSeen } from "@/lib/presence";
import { DEFAULT_PLATFORM_ROLE_KEY, systemRoleId } from "@/lib/rbac";
import { generateHandle, pickUserColor } from "@/lib/user-defaults";
import { provisionNewUser } from "@/lib/user-provisioning";
import { splitName } from "@/lib/utils/string";

// PrismaAdapter mit createUser-Override: OAuth-/Mail-User liefern nur
// name/email/image, aber `handle` und `color` sind NOT NULL. Der volle Name
// kommt als ein Feld vom Provider (oder fehlt beim Mail-Login ganz) und wird
// für unser firstName/lastName-Schema aufgesplittet.
//
// Zugleich der einzige Ort, an dem ein wirklich neues Konto entsteht (Passkey-
// Erstanmeldung, OAuth, Magic Link) — `provisionNewUser()` hängt hier den
// Domain-Auto-Join dran, den früher nur `register()` kannte.
// Alphabet ohne O/0/I/1 — sieht man einem angezeigten Code sonst nicht an,
// welcher der beiden gemeint ist. 8 Zeichen aus 32 möglichen sind zum
// Abtippen kurz genug und trotzdem nicht in vertretbarer Zeit erratbar.
const MAGIC_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAGIC_CODE_LENGTH = 8;

/**
 * Ersetzt next-auths eigenen 32-Byte-Zufallstoken für den Mail-Provider durch
 * einen kurzen, eintippbaren Code — er landet unverändert sowohl im Link
 * (`?token=`) als auch, separat angezeigt, in der Mail selbst
 * (`sendVerificationRequest` unten). Beides prüft dieselbe next-auth-Route
 * gegen denselben gehashten Wert in `VerificationToken` — der Code ist kein
 * zweiter Mechanismus, nur ein zweiter Weg, denselben Token einzugeben.
 */
function generateMagicCode(): string {
  let code = "";
  for (let i = 0; i < MAGIC_CODE_LENGTH; i++) {
    code += MAGIC_CODE_ALPHABET[randomInt(MAGIC_CODE_ALPHABET.length)];
  }
  return code;
}

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
      if (data.email) {
        await provisionNewUser(db, { userId: user.id, email: data.email });
      }
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
  // Passkeys sind in dieser Auth.js-Version hinter einem Experimental-Flag —
  // ohne ihn weist jeder WebAuthn-Aufruf (auch nur die Provider-Auflistung)
  // einen `ExperimentalFeatureNotEnabled`-Fehler zurück.
  experimental: { enableWebAuthn: true },
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Jeder Login läuft hier durch — Passkey wie OAuth, es gibt keinen
     * eigenen `authorize`-Zweig mehr, der stillgelegte Konten woanders
     * abfangen würde.
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

      if (account?.provider) {
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
    // Passkeys — der einzige Weg herein, den diese App selbst betreibt (kein
    // Passwort mehr). `relayingParty.id` ist nur der Hostname (kein
    // Schema/Port) — Browser binden einen Passkey an genau diesen Wert,
    // `origin` bleibt die volle Basis-URL. `enableConditionalUI` erlaubt
    // Autofill über das E-Mail-Feld der Login-Seite.
    WebAuthn({
      relayingParty: {
        id: new URL(appBaseUrl()).hostname,
        name: "Orbit",
        origin: appBaseUrl(),
      },
      enableConditionalUI: true,
    }),
    // Magic Link — nur aktiv, wenn SMTP konfiguriert ist (siehe
    // `isMailConfigured()`); ohne SMTP bleibt der Provider ganz weg, statt
    // eine Mail vorzutäuschen, die nie ankommt. `server` ist ein Dummy-Wert,
    // nur um next-auths internen Truthy-Check zu erfüllen — `sendVerification
    // Request` ruft stattdessen direkt `sendMail()` (`lib/mail/send.ts`) auf,
    // die eigene SMTP-Transport-Logik von next-auth kommt nie zum Einsatz.
    //
    // Der praktische Grund, warum dieser Provider auch bei Einladungen und
    // migrierten Konten ohne Passkey funktioniert, wo WebAuthn/OAuth an
    // `AccountNotLinked` scheitern: `handleLoginOrRegister` behandelt eine
    // bestehende Adresse beim Mail-Provider als Normalfall (Login als dieses
    // Konto), nicht als Kollision — der Klick auf den Link *ist* der Beweis,
    // dass die Adresse der Person gehört.
    //
    // `generateVerificationToken` ersetzt next-auths langen Zufallstoken
    // durch `generateMagicCode()` — dadurch trägt auch der Link nur noch den
    // kurzen Code als `token`, und `maxAge` sinkt auf 15 Minuten statt einer
    // Stunde: weniger Entropie im Token verlangt ein engeres Zeitfenster.
    ...(isMailConfigured()
      ? [
          Nodemailer({
            server: { host: "unused" },
            from: "noreply@orbit.local",
            maxAge: 15 * 60,
            generateVerificationToken: generateMagicCode,
            async sendVerificationRequest({ identifier, url, token }) {
              const { subject, html, text } = magicLinkEmail({
                to: identifier,
                url,
                code: token,
                expiresInMinutes: 15,
              });
              await sendMail({ to: identifier, subject, html, text });
            },
          }),
        ]
      : []),
  ],
});
