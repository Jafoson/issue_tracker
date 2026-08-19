#!/usr/bin/env bun
/**
 * Workaround für einen offenen, ungelösten Bun-Bug (oven-sh/bun#25370, via
 * vercel/next.js#86652/#86866 als Next.js-seitig "closed, ist ein Bun-Bug"
 * eingestuft): Turbopack referenziert Pakete, die es nicht ins SSR-Bundle
 * packt (Next.js' eigene Vorgabe-Liste, u.a. "pg" und "@prisma/client" —
 * `node_modules/next/dist/lib/server-external-packages.jsonc`), zur
 * Laufzeit über einen Namen mit angehängtem Hash (z.B.
 * "pg-587764f78a6c7a9c"). Node/Bun sollen diesen Namen dann per `require()`
 * aus node_modules auflösen — nur dass es kein Paket mit diesem Namen gibt.
 * Ergebnis: "Cannot find module 'pg-<hash>'" bei jedem kalten
 * `.next`-Neubau (leerer/gelöschter Cache), reproduzierbar unabhängig vom
 * eigenen Code.
 *
 * Der Hash ist deterministisch aus dem aktuellen `node_modules`-Layout
 * abgeleitet — stabil, solange sich an den betroffenen Abhängigkeiten
 * nichts ändert, und identisch auf jeder Maschine mit demselben `bun.lock`.
 * Dieses Skript legt für jedes bekannte Paket einen echten Symlink unter
 * genau diesem Namen an, damit die Auflösung klappt. Läuft automatisch nach
 * jedem `bun install` (siehe `package.json` → `postinstall`).
 *
 * ── Wenn nach einem Dependency-Update wieder "Cannot find module '<pkg>-
 *    <hash>'" auftaucht ──
 * Der Hash hat sich verschoben (neue Version, neuer Lockfile-Stand). Neuen
 * Hash aus der Fehlermeldung ablesen und unten in `KNOWN_HASHES` eintragen.
 *
 * Sobald Bun/Turbopack das upstream beheben, kann diese Datei plus der
 * `postinstall`-Eintrag ersatzlos wieder raus.
 */
import { existsSync, symlinkSync, unlinkSync } from "node:fs";
import path from "node:path";

const NODE_MODULES = path.resolve(import.meta.dir, "..", "node_modules");

/** Bekannte Hashes für den aktuellen `bun.lock`-Stand. Bei "Cannot find
 *  module" mit einem anderen Hash: hier den neuen eintragen. */
const KNOWN_HASHES: Record<string, string[]> = {
  pg: ["587764f78a6c7a9c"],
  "@prisma/client": ["2c3a283f134fdcb6"],
};

/** Reales Ziel, auf das der Symlink zeigen soll — für Pakete mit
 *  Subpath-Importen (`@prisma/client/runtime/client`) reicht ein Symlink
 *  auf den Paketordner selbst, Node löst den Rest normal auf. */
const REAL_TARGET: Record<string, string> = {
  pg: path.join(NODE_MODULES, "pg"),
  "@prisma/client": path.join(NODE_MODULES, "@prisma", "client"),
};

let created = 0;
for (const [pkg, hashes] of Object.entries(KNOWN_HASHES)) {
  const target = REAL_TARGET[pkg];
  if (!target || !existsSync(target)) continue; // Paket (noch) nicht installiert.

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
      // Gab es noch nicht — normal.
    }
    symlinkSync(target, linkPath, "dir");
    created++;
  }
}

if (created > 0) {
  console.log(
    `[fix-turbopack-bun-externals] ${created} Symlink(s) für Turbopacks externe Module angelegt.`,
  );
}
