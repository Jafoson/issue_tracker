/**
 * Converts existing data from Markdown to ProseMirror JSON.
 *
 *   bun run scripts/migrate-richtext.ts     # before `prisma migrate deploy`
 *
 * Deliberately runs over raw SQL instead of the Prisma client: by the time
 * this runs, the schema already describes the columns as `Json`, but in the
 * database they're still `text`. The generated client would disagree about
 * that — `$queryRaw` doesn't.
 *
 * The script is safe to run more than once: whatever is already a document
 * gets skipped. It writes into the same column; the type change afterwards is
 * handled by `prisma/migrations/20260731120000_richtext_documents`.
 */

import { db } from "@/lib/db";
import { fromMarkdown } from "@/lib/richtext/fromMarkdown";
import { toPlainText } from "@/lib/richtext/text";

/** Already converted? Then the column holds a serialized document. */
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
  // `::text` forces the text value — regardless of whether the column is
  // already jsonb or still text. That way the script also runs without
  // errors after the migration.
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
    `${table}.${column}: ${converted} converted, ${skipped} already a document (${rows.length} total)`,
  );
}

async function main() {
  await convert("Issue", "description");
  await convert("Comment", "body");

  // The derived plain-text column only exists after the type change — the
  // columns don't exist yet before that. So only do this once already
  // migrated.
  const [{ exists }] = await db.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'Issue' AND column_name = 'descriptionText'
    ) AS exists
  `;

  if (!exists) {
    console.log(
      "\nDone. Now run `bun prisma migrate deploy` — that sets the column type.",
    );
    return;
  }

  await backfillText("Issue", "description", "descriptionText");
  await backfillText("Comment", "body", "bodyText");
  console.log("\nDone.");
}

/** Sets the derived text column the same way the application does. */
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
  console.log(`${table}.${target}: ${rows.length} rows re-derived`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
