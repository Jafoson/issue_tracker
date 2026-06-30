import { defineRouting } from "next-intl/routing";

// Single Source of Truth für die unterstützten Sprachen und das Routing-Verhalten.
export const routing = defineRouting({
  locales: ["de", "en"],
  defaultLocale: "de",
  // Die App präfixt URLs bislang immer mit der Locale (/de/…, /en/…).
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
