import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ hostname: "www.gravatar.com" }],
  },
  // Kein next.config-Workaround für den Turbopack+Bun-Externals-Bug nötig —
  // siehe `scripts/fix-turbopack-bun-externals.ts` (läuft per `postinstall`).
};

export default withNextIntl(nextConfig);
