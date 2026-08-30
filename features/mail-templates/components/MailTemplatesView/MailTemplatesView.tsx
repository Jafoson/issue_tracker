"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import type { MailTemplateKey } from "@/features/mail-templates/catalog";
import { MailTemplateEditor } from "@/features/mail-templates/components/MailTemplateEditor/MailTemplateEditor";
import type { MailTemplateRow } from "@/features/mail-templates/types";
import styles from "./mailTemplatesView.module.scss";

interface Props {
  rows: MailTemplateRow[];
  /** Suggestion for the "Send test mail" field — the user's own address. */
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
 * View and edit the subject, heading, and intro text of every mail
 * template — list on the left, editor with a live preview on the right.
 * Layout, detail tables, and button text stay in code
 * (`lib/mail/templates/`); only what's in `MailTemplate`
 * (`features/mail-templates`) changes here.
 */
export function MailTemplatesView({ rows, defaultTestEmail }: Props) {
  const [selectedKey, setSelectedKey] = useState<MailTemplateKey>(rows[0]?.key);
  const groups = groupBy(rows);
  const selected = rows.find((r) => r.key === selectedKey) ?? rows[0];

  return (
    <div className={styles.wrap}>
      <PageHeader
        title="Mail templates"
        description="Subject, heading, and intro text — layout and button stay unchanged."
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
                    <span className={styles.dot} title="Customized" />
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
