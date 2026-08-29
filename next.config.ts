import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ hostname: "www.gravatar.com" }],
  },
  // No next.config workaround needed for the Turbopack+Bun externals bug —
  // see `scripts/fix-turbopack-bun-externals.ts` (runs via `postinstall`).
};

export default withNextIntl(nextConfig);
