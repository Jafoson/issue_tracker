import type { DefaultSession } from "next-auth";
import type { routing } from "@/i18n/routing";
import type messages from "./messages/de.json";

// Gibt next-intl die konkreten Typen: getypte Message-Keys bei t("…") und
// useLocale() liefert die Locale-Union statt string.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}

// Auth.js: `id` und die globale Plattform-Rolle auf der Session verfügbar machen
// (aus dem JWT-Callback gespiegelt).
declare module "next-auth" {
  interface Session {
    user: { id: string; globalRole: string } & DefaultSession["user"];
  }
  // Was `authorize`/der Adapter zurückgeben und der jwt-Callback als `user` erhält.
  interface User {
    globalRole?: string;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    globalRole?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    globalRole?: string;
  }
}
