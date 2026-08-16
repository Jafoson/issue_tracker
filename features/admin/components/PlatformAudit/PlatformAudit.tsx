"use client";

import { useTranslations } from "next-intl";
import { AuditLog } from "@/features/audit/components/AuditLog/AuditLog";
import type { AuditEntry } from "@/lib/audit/actions";

interface Props {
  entries: AuditEntry[];
}

/**
 * Das Protokoll der Plattform — dünner Wrapper um `AuditLog`
 * (`features/audit/components/AuditLog`), der nur die Plattform-Texte mitgibt.
 * Dieselbe Anzeige tragen die Aktivitäts-Seiten von Projekt und Workspace unter
 * den Einstellungen, mit ihren eigenen Titeln.
 */
export function PlatformAudit({ entries }: Props) {
  const t = useTranslations();
  return (
    <AuditLog
      entries={entries}
      title={t("nav.audit")}
      description={t("audit.desc")}
    />
  );
}
