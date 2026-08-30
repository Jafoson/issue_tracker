"use server";

import { revalidatePath } from "next/cache";
import {
  MAIL_TEMPLATE_KEYS,
  type MailTemplateKey,
  mailTemplateMeta,
} from "@/features/mail-templates/catalog";
import { renderMailPreview } from "@/features/mail-templates/preview";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { isMailConfigured, sendMail } from "@/lib/mail";
import { PLATFORM, requirePermission } from "@/lib/permissions";

type MailTemplateResult = { ok: true } | { error: string };

function isMailTemplateKey(value: string): value is MailTemplateKey {
  return (MAIL_TEMPLATE_KEYS as readonly string[]).includes(value);
}

/**
 * Saves subject, heading, and intro text for a template — layout, detail
 * tables, and the button stay in code (see
 * `lib/mail/templates/override.ts`). An empty field is allowed (then it
 * simply shows nothing) — the only requirement is that the key belongs to a
 * known template.
 */
export async function saveMailTemplate(
  key: string,
  data: { subject: string; heading: string; bodyText: string },
): Promise<MailTemplateResult> {
  const actorId = await requirePermission("mail.template.manage", PLATFORM);
  if (!isMailTemplateKey(key)) return { error: "Unknown template." };

  await db.mailTemplate.upsert({
    where: { key },
    update: data,
    create: { key, ...data },
  });

  await recordAudit({
    action: "mail.template.updated",
    actorId,
    target: {
      type: "mailTemplate",
      id: key,
      label: mailTemplateMeta(key).label,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Sends the current draft (not yet saved) with sample data to a test
 * address — the same path as the preview (`renderMailPreview`), just
 * actually sent via `sendMail()` instead of only rendered into the iframe.
 * Saves nothing.
 */
export async function sendTestMailTemplate(
  key: string,
  draft: { subject: string; heading: string; bodyText: string },
  to: string,
): Promise<MailTemplateResult> {
  await requirePermission("mail.template.manage", PLATFORM);
  if (!isMailTemplateKey(key)) return { error: "Unknown template." };

  const email = to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please provide a valid email address." };
  }
  if (!isMailConfigured()) {
    return { error: "SMTP is not configured (SMTP_HOST is missing)." };
  }

  const override =
    draft.subject || draft.heading || draft.bodyText ? draft : undefined;
  const { subject, html, text } = renderMailPreview(key, override);
  await sendMail({ to: email, subject: `[Test] ${subject}`, html, text });

  return { ok: true };
}

/** Deletes the override — the template falls back to the code default. */
export async function resetMailTemplate(
  key: string,
): Promise<MailTemplateResult> {
  const actorId = await requirePermission("mail.template.manage", PLATFORM);
  if (!isMailTemplateKey(key)) return { error: "Unknown template." };

  await db.mailTemplate.deleteMany({ where: { key } });

  await recordAudit({
    action: "mail.template.reset",
    actorId,
    target: {
      type: "mailTemplate",
      id: key,
      label: mailTemplateMeta(key).label,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
