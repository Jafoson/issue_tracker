import { defineRouting } from "next-intl/routing";

// Single source of truth for the supported languages and the routing behavior.
export const routing = defineRouting({
  locales: ["de", "en"],
  defaultLocale: "de",
  // The app always prefixes URLs with the locale so far (/de/…, /en/…).
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
