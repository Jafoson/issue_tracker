import "server-only";
import { db } from "@/lib/db";
import type { TemplateOverride } from "@/lib/mail/templates/override";

/** Der Admin-Override für eine Vorlage, wenn einer gesetzt ist — sonst
 *  `undefined`, damit die Vorlagenfunktionen ihren Code-Default nehmen
 *  (`override?: TemplateOverride` in jeder `lib/mail/templates/*.ts`). */
export async function getMailTemplateOverride(
  key: string,
): Promise<TemplateOverride | undefined> {
  const row = await db.mailTemplate.findUnique({ where: { key } });
  if (!row) return undefined;
  return { subject: row.subject, heading: row.heading, bodyText: row.bodyText };
}
