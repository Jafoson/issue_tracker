#!/usr/bin/env bun
/**
 * Workaround for an open, unresolved Bun bug (oven-sh/bun#25370, classified
 * on the Next.js side via vercel/next.js#86652/#86866 as "closed, it's a Bun
 * bug"): Turbopack references packages it doesn't bundle for SSR (Next.js's
 * own default list, including "pg" and "@prisma/client" —
 * `node_modules/next/dist/lib/server-external-packages.jsonc`), at runtime,
 * under a name with a hash appended (e.g. "pg-587764f78a6c7a9c"). Node/Bun
 * are then supposed to resolve that name via `require()` from node_modules —
 * except no package with that name exists. Result: "Cannot find module
 * 'pg-<hash>'" on every cold `.next` rebuild (empty/deleted cache),
 * reproducible independent of our own code.
 *
 * The hash is deterministically derived from the current `node_modules`
 * layout — stable as long as the affected dependencies don't change, and
 * identical on every machine with the same `bun.lock`. This script creates a
 * real symlink under exactly that name for each known package, so resolution
 * succeeds. Runs automatically after every `bun install` (see `package.json`
 * → `postinstall`).
 *
 * ── If "Cannot find module '<pkg>-<hash>'" comes back after a dependency
 *    update ──
 * The hash has shifted (new version, new lockfile state). Read the new hash
 * off the error message and add it to `KNOWN_HASHES` below.
 *
 * Once Bun/Turbopack fix this upstream, this file plus the `postinstall`
 * entry can be removed without replacement.
 */
import { existsSync, symlinkSync, unlinkSync } from "node:fs";
import path from "node:path";

const NODE_MODULES = path.resolve(import.meta.dir, "..", "node_modules");

/** Known hashes for the current `bun.lock` state. On "Cannot find module"
 *  with a different hash: add the new one here. */
const KNOWN_HASHES: Record<string, string[]> = {
  pg: ["587764f78a6c7a9c"],
  "@prisma/client": ["2c3a283f134fdcb6"],
};

/** Real target the symlink should point to — for packages with subpath
 *  imports (`@prisma/client/runtime/client`), a symlink to the package
 *  folder itself is enough, Node resolves the rest normally. */
const REAL_TARGET: Record<string, string> = {
  pg: path.join(NODE_MODULES, "pg"),
  "@prisma/client": path.join(NODE_MODULES, "@prisma", "client"),
};

let created = 0;
for (const [pkg, hashes] of Object.entries(KNOWN_HASHES)) {
  const target = REAL_TARGET[pkg];
  if (!target || !existsSync(target)) continue; // Package not installed (yet).

  for (const hash of hashes) {
    const linkPath = pkg.startsWith("@")
      ? path.join(
          NODE_MODULES,
          pkg.split("/")[0],
          `${pkg.split("/")[1]}-${hash}`,
        )
      : path.join(NODE_MODULES, `${pkg}-${hash}`);

    if (existsSync(linkPath)) continue;
    try {
      unlinkSync(linkPath);
    } catch {
      // Didn't exist yet — normal.
    }
    symlinkSync(target, linkPath, "dir");
    created++;
  }
}

if (created > 0) {
  console.log(
    `[fix-turbopack-bun-externals] Created ${created} symlink(s) for Turbopack's external modules.`,
  );
}
