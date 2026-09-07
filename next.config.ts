import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [{ hostname: "www.gravatar.com" }],
  },
  // Next's file tracing misses both of these because neither is a static
  // import it can see: `lib/generated/prisma` is produced by `prisma
  // generate` (gitignored, not source Next scans), and the pg-*/@prisma/
  // client-* entries are hash-named node_modules symlinks that work around
  // the Turbopack+Bun externals bug (scripts/fix-turbopack-bun-externals.ts)
  // — the compiled server bundle requires them by that literal hashed name,
  // but nft's static analysis never resolves it back to the real packages.
  // Without this, `output: "standalone"` silently ships a server that
  // crashes on its first Prisma query. Deliberately NOT including the
  // `prisma` CLI package here — it drags in ~200MB of engine binaries
  // (schema engine, Prisma Studio) that the running app never needs;
  // `prisma migrate deploy` instead runs from the `builder` stage as a
  // separate one-off step (see docker-compose.prod.yml's `migrate` service).
  outputFileTracingIncludes: {
    "/*": [
      "lib/generated/prisma/**/*",
      "node_modules/pg-*/**/*",
      "node_modules/@prisma/client-*/**/*",
    ],
  },
};

export default withNextIntl(nextConfig);
