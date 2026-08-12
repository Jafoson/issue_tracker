import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { getMyPreferences } from "@/features/account/queries";
import { routing } from "@/i18n/routing";
import { DockProvider, ModalProvider } from "@/lib/context";

// Design tokens — imported first so they're available everywhere
import "@/styles/colors.scss";
import "@/styles/dimensions.css";
import "@/styles/typography.css";

// Base styles, resets & component utility classes
import "@/styles/globals.scss";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-ui",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Orbit — Issue Tracker",
  description: "Open source issue tracker",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Stellt das Locale für Server Components bereit.
  setRequestLocale(locale);

  // Das Design gehört der Person, und `<html>` gibt es nur hier — deshalb wird
  // es an dieser Stelle aufgelöst und nicht weiter unten. Es kostet nichts, wo
  // niemand angemeldet ist: `getMyPreferences` liest erst die Session und gibt
  // ohne sie die Vorgaben zurück, ohne die Datenbank zu fragen. Die
  // Anmeldeseite bleibt damit dunkel, wie sie es vorher auch war.
  //
  // Serverseitig gesetzt statt per Skript im Browser: das Attribut steht so
  // schon im ersten Byte des Dokuments. „System" löst CSS auf (styles/colors.scss).
  const { theme } = await getMyPreferences();

  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${hankenGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        {/* Messages/Locale werden automatisch aus der Server-Konfiguration übernommen. */}
        <NextIntlClientProvider>
          {/* Das Dock liegt innerhalb des Modal-Providers: sein Panel muss
              wissen, ob ein Modal darüber steht, um Escape abzugeben. */}
          <ModalProvider>
            <DockProvider>{children}</DockProvider>
          </ModalProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
