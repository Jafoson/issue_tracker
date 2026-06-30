import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

// Design tokens — imported first so they're available everywhere
import "@/styles/colors.css";
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

  // Aktiviert statisches Rendering und stellt das Locale für Server Components bereit.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      data-theme="dark"
      data-density="airy"
      className={`${hankenGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        {/* Messages/Locale werden automatisch aus der Server-Konfiguration übernommen. */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
