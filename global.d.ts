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
