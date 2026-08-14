import type {
  MailTemplateKey,
  MailTemplateMeta,
} from "@/features/mail-templates/catalog";
import type { TemplateOverride } from "@/lib/mail/templates/override";

export interface MailTemplateRow {
  key: MailTemplateKey;
  meta: MailTemplateMeta;
  /** `null` = kein Override in der DB, es gilt der Code-Default. */
  override: TemplateOverride | null;
  updatedAt: number | null;
}
