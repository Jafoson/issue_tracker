import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Orbit — Issue Tracker",
  description: "Open source issue tracker",
};

// Das <html>/<body>-Markup lebt in app/[locale]/layout.tsx, da es das aktive
// Locale benötigt (next-intl-Pattern mit [locale]-Segment). Der Root-Layout
// reicht daher nur durch.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
