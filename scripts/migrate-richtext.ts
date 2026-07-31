/**
 * Wandelt die Bestandsdaten von Markdown nach ProseMirror-JSON um.
 *
 *   bun run scripts/migrate-richtext.ts     # vor `prisma migrate deploy`
 *
 * Läuft absichtlich über rohes SQL statt über den Prisma-Client: zum Zeitpunkt
 * des Aufrufs beschreibt das Schema die Spalten bereits als `Json`, in der
 * Datenbank stehen sie aber noch als `text`. Der generierte Client wäre sich
 * darüber uneinig — `$queryRaw` ist es nicht.
 *
 * Das Skript ist mehrfach ausführbar: was schon ein Dokument ist, wird
 * übersprungen. Es schreibt in dieselbe Spalte; den Typwechsel macht danach
 * `prisma/migrations/20260731120000_richtext_documents`.
 */

import { db } from "@/lib/db";
import { fromMarkdown } from "@/lib/richtext/fromMarkdown";
import { toPlainText } from "@/lib/richtext/text";

/** Schon umgewandelt? Dann liegt in der Spalte ein serialisiertes Dokument. */
function isAlreadyDoc(value: string): boolean {
  if (!value.trimStart().startsWith("{")) return false;
  try {
    return JSON.parse(value)?.type === "doc";
  } catch {
    return false;
  }
}

async function convert(
  table: "Issue" | "Comment",
  column: "description" | "body",
) {
  // `::text` erzwingt den Textwert — egal, ob die Spalte schon jsonb ist oder
  // noch text. Damit läuft das Skript auch nach der Migration ohne Fehler.
  const rows = await db.$queryRawUnsafe<
    { id: string; source: string | null }[]
  >(`SELECT "id", "${column}"::text AS source FROM "${table}"`);

  let converted = 0;
  let skipped = 0;

  for (const row of rows) {
    const source = row.source ?? "";
    if (isAlreadyDoc(source)) {
      skipped++;
      continue;
    }

    const doc = fromMarkdown(source);
    await db.$executeRawUnsafe(
      `UPDATE "${table}" SET "${column}" = $1 WHERE "id" = $2`,
      JSON.stringify(doc),
      row.id,
    );
    converted++;
  }

  console.log(
    `${table}.${column}: ${converted} umgewandelt, ${skipped} bereits Dokument (${rows.length} gesamt)`,
  );
}

async function main() {
  await convert("Issue", "description");
  await convert("Comment", "body");

  // Den abgeleiteten Fließtext gibt es erst nach dem Typwechsel — die Spalten
  // existieren vorher noch nicht. Deshalb hier nur, wenn schon migriert wurde.
  const [{ exists }] = await db.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'Issue' AND column_name = 'descriptionText'
    ) AS exists
  `;

  if (!exists) {
    console.log(
      "\nFertig. Jetzt `bun prisma migrate deploy` — das setzt den Spaltentyp.",
    );
    return;
  }

  await backfillText("Issue", "description", "descriptionText");
  await backfillText("Comment", "body", "bodyText");
  console.log("\nFertig.");
}

/** Setzt die abgeleitete Textspalte über denselben Weg wie die Anwendung. */
async function backfillText(
  table: "Issue" | "Comment",
  column: string,
  target: string,
) {
  const rows = await db.$queryRawUnsafe<{ id: string; doc: string }[]>(
    `SELECT "id", "${column}"::text AS doc FROM "${table}"`,
  );

  for (const row of rows) {
    await db.$executeRawUnsafe(
      `UPDATE "${table}" SET "${target}" = $1 WHERE "id" = $2`,
      toPlainText(JSON.parse(row.doc)),
      row.id,
    );
  }
  console.log(`${table}.${target}: ${rows.length} Zeilen neu abgeleitet`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
