import "server-only";
import { db } from "@/lib/db";
import type { TemplateOverride } from "@/lib/mail/templates/override";

/** The admin override for a template, if one is set — otherwise
 *  `undefined`, so the template functions fall back to their code default
 *  (`override?: TemplateOverride` in every `lib/mail/templates/*.ts`). */
export async function getMailTemplateOverride(
  key: string,
): Promise<TemplateOverride | undefined> {
  const row = await db.mailTemplate.findUnique({ where: { key } });
  if (!row) return undefined;
  return { subject: row.subject, heading: row.heading, bodyText: row.bodyText };
}
