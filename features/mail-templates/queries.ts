import "server-only";
import { cache } from "react";
import {
  MAIL_TEMPLATE_CATALOG,
  MAIL_TEMPLATE_KEYS,
} from "@/features/mail-templates/catalog";
import type { MailTemplateRow } from "@/features/mail-templates/types";
import { db } from "@/lib/db";
import { PLATFORM, requirePermission } from "@/lib/permissions";

/**
 * All templates with their catalog entry and the DB override, if any — for
 * the admin editor. Checks itself; the admin layout isn't a security
 * boundary for individual queries (see `features/admin/queries.ts`).
 */
export const getMailTemplates = cache(async (): Promise<MailTemplateRow[]> => {
  await requirePermission("mail.template.manage", PLATFORM);

  const rows = await db.mailTemplate.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));

  return MAIL_TEMPLATE_KEYS.map((key) => {
    const row = byKey.get(key);
    return {
      key,
      meta: MAIL_TEMPLATE_CATALOG[key],
      override: row
        ? { subject: row.subject, heading: row.heading, bodyText: row.bodyText }
        : null,
      updatedAt: row ? row.updatedAt.getTime() : null,
    };
  });
});

/** Your own address — as a suggestion in the "Send test mail" field, so it
 *  doesn't have to be typed in fresh every time. */
export const getCurrentAdminEmail = cache(async (): Promise<string> => {
  const actorId = await requirePermission("mail.template.manage", PLATFORM);
  const user = await db.user.findUnique({
    where: { id: actorId },
    select: { email: true },
  });
  return user?.email ?? "";
});
