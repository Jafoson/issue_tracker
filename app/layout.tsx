import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";

// Design tokens — imported first so they're available everywhere
import "@/styles/colors.css";
import "@/styles/dimensions.css";
import "@/styles/typography.css";

// Base styles, resets & component utility classes
import "./globals.scss";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="de"
      data-theme="dark"
      data-density="airy"
      className={`${hankenGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
