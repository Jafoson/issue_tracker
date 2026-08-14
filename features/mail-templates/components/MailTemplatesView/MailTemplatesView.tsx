"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import type { MailTemplateKey } from "@/features/mail-templates/catalog";
import { MailTemplateEditor } from "@/features/mail-templates/components/MailTemplateEditor/MailTemplateEditor";
import type { MailTemplateRow } from "@/features/mail-templates/types";
import styles from "./mailTemplatesView.module.scss";

interface Props {
  rows: MailTemplateRow[];
  /** Vorschlag fürs „Testmail senden“-Feld — die eigene Adresse. */
  defaultTestEmail: string;
}

function groupBy(rows: MailTemplateRow[]): Map<string, MailTemplateRow[]> {
  const groups = new Map<string, MailTemplateRow[]>();
  for (const row of rows) {
    const list = groups.get(row.meta.group) ?? [];
    list.push(row);
    groups.set(row.meta.group, list);
  }
  return groups;
}

/**
 * Betreff, Überschrift und Einleitungstext jeder Mail-Vorlage einsehen und
 * bearbeiten — Liste links, Editor mit Live-Vorschau rechts. Layout,
 * Detailtabellen und Knopftext bleiben Code (`lib/mail/templates/`); hier
 * ändert sich nur, was in `MailTemplate` steht (`features/mail-templates`).
 */
export function MailTemplatesView({ rows, defaultTestEmail }: Props) {
  const [selectedKey, setSelectedKey] = useState<MailTemplateKey>(rows[0]?.key);
  const groups = groupBy(rows);
  const selected = rows.find((r) => r.key === selectedKey) ?? rows[0];

  return (
    <div className={styles.wrap}>
      <PageHeader
        title="Mail-Vorlagen"
        description="Betreff, Überschrift und Einleitungstext — Layout und Knopf bleiben unverändert."
        className={styles.pageHeader}
      />
      <div className={styles.body}>
        <nav className={styles.list}>
          {[...groups.entries()].map(([group, items]) => (
            <div key={group} className={styles.group}>
              <span className={styles.groupLabel}>{group}</span>
              {items.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  className={styles.item}
                  data-active={row.key === selected?.key || undefined}
                  onClick={() => setSelectedKey(row.key)}
                >
                  <span className={styles.itemLabel}>{row.meta.label}</span>
                  {row.override && (
                    <span className={styles.dot} title="Angepasst" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        {selected && (
          <MailTemplateEditor
            key={selected.key}
            row={selected}
            defaultTestEmail={defaultTestEmail}
          />
        )}
      </div>
    </div>
  );
}
