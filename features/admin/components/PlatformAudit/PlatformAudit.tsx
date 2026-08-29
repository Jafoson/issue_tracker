"use client";

import { useTranslations } from "next-intl";
import { loadMorePlatformActivity } from "@/features/admin/actions";
import { AuditLog } from "@/features/audit/components/AuditLog/AuditLog";
import type { AuditEntry } from "@/lib/audit/actions";

interface Props {
  entries: AuditEntry[];
  nextCursor: string | null;
}

/**
 * The platform's audit log — a thin wrapper around `AuditLog`
 * (`features/audit/components/AuditLog`) that only supplies the platform
 * copy. The project's and workspace's activity pages under settings use the
 * same display, with their own titles.
 */
export function PlatformAudit({ entries, nextCursor }: Props) {
  const t = useTranslations();
  return (
    <AuditLog
      entries={entries}
      nextCursor={nextCursor}
      loadMore={loadMorePlatformActivity}
      title={t("nav.audit")}
      description={t("audit.desc")}
    />
  );
}
