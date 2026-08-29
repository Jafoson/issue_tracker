import type { DefaultSession } from "next-auth";
import type { routing } from "@/i18n/routing";
import type messages from "./messages/de.json";

// Gives next-intl its concrete types: typed message keys for t("…"), and
// useLocale() returns the locale union instead of string.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}

// Auth.js: expose `id` and the display data on the session (mirrored from
// the jwt callback). Roles and permissions deliberately do NOT live in the
// token — `lib/permissions.ts` resolves those fresh from the database on
// every check.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      color: string;
      firstName: string;
      lastName: string;
    } & DefaultSession["user"];
  }
  // What `authorize`/the adapter return and the jwt callback receives as `user`.
  interface User {
    color?: string;
    firstName?: string;
    lastName?: string;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    color?: string;
    firstName?: string;
    lastName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    color?: string;
    firstName?: string;
    lastName?: string;
  }
}
