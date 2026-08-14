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
 * Speichert Betreff, Überschrift und Einleitungstext für eine Vorlage — Layout,
 * Detailtabellen und Knopf bleiben Code (siehe `lib/mail/templates/override.ts`).
 * Ein leeres Feld ist erlaubt (dann steht dort eben nichts) — Pflicht ist nur,
 * dass der Schlüssel zu einer bekannten Vorlage gehört.
 */
export async function saveMailTemplate(
  key: string,
  data: { subject: string; heading: string; bodyText: string },
): Promise<MailTemplateResult> {
  const actorId = await requirePermission("mail.template.manage", PLATFORM);
  if (!isMailTemplateKey(key)) return { error: "Unbekannte Vorlage." };

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
 * Verschickt die aktuelle Entwurfsfassung (noch ungespeichert) mit
 * Beispieldaten an eine Testadresse — derselbe Weg wie die Vorschau
 * (`renderMailPreview`), nur tatsächlich durch `sendMail()` geschickt statt
 * nur ins iframe gerendert. Speichert nichts.
 */
export async function sendTestMailTemplate(
  key: string,
  draft: { subject: string; heading: string; bodyText: string },
  to: string,
): Promise<MailTemplateResult> {
  await requirePermission("mail.template.manage", PLATFORM);
  if (!isMailTemplateKey(key)) return { error: "Unbekannte Vorlage." };

  const email = to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Bitte eine gültige E-Mail-Adresse angeben." };
  }
  if (!isMailConfigured()) {
    return { error: "SMTP ist nicht konfiguriert (SMTP_HOST fehlt)." };
  }

  const override =
    draft.subject || draft.heading || draft.bodyText ? draft : undefined;
  const { subject, html, text } = renderMailPreview(key, override);
  await sendMail({ to: email, subject: `[Test] ${subject}`, html, text });

  return { ok: true };
}

/** Löscht den Override — die Vorlage fällt zurück auf den Code-Default. */
export async function resetMailTemplate(
  key: string,
): Promise<MailTemplateResult> {
  const actorId = await requirePermission("mail.template.manage", PLATFORM);
  if (!isMailTemplateKey(key)) return { error: "Unbekannte Vorlage." };

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
