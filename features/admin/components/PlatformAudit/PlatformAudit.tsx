"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Chip } from "@/components/ui/atoms/Chip/Chip";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
// `@/lib/audit/actions` und nicht `@/lib/audit`: diese Liste rendert im
// Browser, und der Server-Teil daneben trägt `server-only` samt Prisma-Client.
import {
  type AuditAction,
  type AuditEntry,
  toAuditAction,
} from "@/lib/audit/actions";
import { useTimeAgo } from "@/lib/utils/useTimeAgo";
import styles from "./platformAudit.module.scss";

interface Props {
  entries: AuditEntry[];
}

/**
 * Wie ein Vorgang in der Liste erscheint: sein Zeichen, seine Beschriftung, und
 * ob er auffallen soll.
 *
 * Die Zeichen gruppieren, was zusammengehört — alles um den Zutritt trägt einen
 * Schlüssel, alles um Rechte ein Schild, alles Zerstörerische einen Papierkorb,
 * und der Notfall-Zugriff sein eigenes, das es sonst nirgends gibt.
 *
 * `message` ist der Name in `messages/*.json` und **nicht** der Schlüssel des
 * Vorgangs. Der trägt Punkte, und next-intl liest einen Punkt als
 * Verschachtelung: `audit.action.auth.login` wäre ein Objekt `auth` mit einem
 * Feld `login` — und `auth.login.failed` verlangte, dass `login` gleichzeitig
 * Text und Objekt ist. Die Nachrichten heißen deshalb flach, und diese Tabelle
 * ist die Brücke zwischen beiden Welten.
 *
 * `satisfies Record<AuditAction, …>` ist die eigentliche Absicherung: ein neuer
 * Vorgang in `lib/audit.ts` bricht hier den Typecheck, bis er auch ein Zeichen
 * und eine Beschriftung hat.
 */
const ACTIONS = {
  "auth.login": { icon: "lucide:log-in", message: "authLogin" },
  "auth.login.failed": {
    icon: "lucide:shield-x",
    message: "authLoginFailed",
    loud: true,
  },
  "user.role.platform": {
    icon: "lucide:shield-check",
    message: "userRolePlatform",
  },
  "user.deactivated": { icon: "lucide:user-x", message: "userDeactivated" },
  "user.reactivated": { icon: "lucide:user-check", message: "userReactivated" },
  "member.role.changed": {
    icon: "lucide:shield-check",
    message: "memberRoleChanged",
  },
  "project.breakglass": {
    icon: "lucide:siren",
    message: "projectBreakglass",
    loud: true,
  },
  "project.owner.changed": {
    icon: "lucide:replace",
    message: "projectOwnerChanged",
  },
  "project.archived": { icon: "lucide:archive", message: "projectArchived" },
  "project.unarchived": {
    icon: "lucide:archive-restore",
    message: "projectUnarchived",
  },
  "project.deleted": {
    icon: "lucide:trash-2",
    message: "projectDeleted",
    loud: true,
  },
  "workspace.suspended": {
    icon: "lucide:ban",
    message: "workspaceSuspended",
    loud: true,
  },
  "workspace.unsuspended": {
    icon: "lucide:circle-check",
    message: "workspaceUnsuspended",
  },
  "workspace.deleted": {
    icon: "lucide:trash-2",
    message: "workspaceDeleted",
    loud: true,
  },
} as const satisfies Record<
  AuditAction,
  { icon: string; message: string; loud?: boolean }
>;

/** Was ein unbekannter Vorgang bekommt — ein Punkt und sonst nichts. */
const UNKNOWN_ICON = "lucide:dot";

function metaOf(action: string) {
  const known = toAuditAction(action);
  return known ? ACTIONS[known] : null;
}

function isLoud(action: string): boolean {
  const meta = metaOf(action);
  return meta !== null && "loud" in meta && meta.loud;
}

/**
 * Das Protokoll: wer, wann, was — und woran.
 *
 * Es lässt sich nicht bearbeiten und nicht löschen; es gibt dafür keine Aktion,
 * weder hier noch im Server (`lib/audit.ts`). Was die Ansicht anbietet, ist ein
 * Filter, und der ist bewusst grob: „alles" oder „nur das Laute". Ein Protokoll,
 * das man erst richtig einstellen muss, bevor es etwas zeigt, wird nicht
 * gelesen.
 *
 * Die Namen in den Zeilen sind die von damals, nicht die von heute — sie wurden
 * beim Schreiben eingefroren. Wer sein Konto umbenennt, ändert damit nicht, was
 * das Protokoll über ihn sagt.
 */
export function PlatformAudit({ entries }: Props) {
  const t = useTranslations();
  const timeAgo = useTimeAgo();
  const [loudOnly, setLoudOnly] = useState(false);

  const rows = loudOnly ? entries.filter((e) => isLoud(e.action)) : entries;

  // Unbekannte Schlüssel zeigt die Liste roh statt gar nicht: das Protokoll ist
  // älter als jede Fassung der Oberfläche, und eine Zeile, die diese Fassung
  // nicht benennen kann, soll trotzdem dastehen.
  const label = (action: string) => {
    const meta = metaOf(action);
    return meta ? t(`audit.action.${meta.message}`) : action;
  };

  const columns: TableColumn<AuditEntry>[] = [
    {
      id: "action",
      header: t("audit.colAction"),
      width: "minmax(0, 1fr)",
      sortValue: (row) => row.action,
      cell: (row) => (
        <span
          className={styles.action}
          data-loud={isLoud(row.action) || undefined}
        >
          <Icon
            icon={metaOf(row.action)?.icon ?? UNKNOWN_ICON}
            width={15}
            className={styles.icon}
          />
          <span className={styles.actionText}>
            <span className={styles.actionName}>{label(row.action)}</span>
            {row.targetLabel && (
              <span className={styles.target}>{row.targetLabel}</span>
            )}
          </span>
        </span>
      ),
    },
    {
      id: "actor",
      header: t("audit.colActor"),
      width: "minmax(200px, max-content)",
      sortValue: (row) => row.actorLabel,
      cell: (row) => <span className={styles.actor}>{row.actorLabel}</span>,
    },
    {
      id: "reason",
      header: t("audit.colReason"),
      width: "minmax(0, 1.2fr)",
      sortValue: (row) => row.reason,
      // Steht nur beim Notfall-Zugriff und ist dort die eigentliche Aussage der
      // Zeile — deshalb eine eigene Spalte und keine Fußnote.
      cell: (row) =>
        row.reason ? (
          <span className={styles.reason} title={row.reason}>
            {row.reason}
          </span>
        ) : (
          <span className={styles.empty}>—</span>
        ),
    },
    {
      id: "when",
      header: t("audit.colWhen"),
      width: "minmax(130px, max-content)",
      align: "end",
      sortValue: (row) => row.createdAt,
      cell: (row) => (
        <time
          className={styles.when}
          dateTime={row.createdAt.toISOString()}
          title={row.createdAt.toLocaleString()}
        >
          {timeAgo(row.createdAt.getTime())}
        </time>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.audit")}
        count={rows.length}
        description={t("audit.desc")}
        actions={
          <Chip
            type="filter"
            icon={<Icon icon="lucide:siren" width={14} />}
            selected={loudOnly}
            onClick={() => setLoudOnly((value) => !value)}
          >
            {t("audit.loudOnly")}
          </Chip>
        }
      />

      <div className={styles.content}>
        <Table
          variant="card"
          label={t("nav.audit")}
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              icon={<Icon icon="lucide:scroll-text" width={32} />}
              title={t("audit.emptyTitle")}
              description={t("audit.emptyDesc")}
            />
          }
        />
      </div>
    </>
  );
}
