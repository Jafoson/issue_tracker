"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Chip } from "@/components/ui/atoms/Chip/Chip";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { Label } from "@/components/ui/atoms/Label/Label";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { LoadMoreSentinel } from "@/components/ui/layout/Table/LoadMoreSentinel/LoadMoreSentinel";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import { useInfiniteScroll } from "@/components/ui/layout/Table/useInfiniteScroll";
import type { ActivityPage } from "@/features/audit/actions";
import {
  PriorityIcon,
  StatusIcon,
} from "@/features/issues/components/IssueIcons/IssueIcons";
import { Link } from "@/i18n/navigation";
// `@/lib/audit/actions` und nicht `@/lib/audit`: diese Liste rendert im
// Browser, und der Server-Teil daneben trägt `server-only` samt Prisma-Client.
import {
  type AuditAction,
  type AuditEntry,
  actorDisplayName,
  type LabelsChangeMeta,
  type PriorityChangeMeta,
  parseTargetLabel,
  type StatusChangeMeta,
  toAuditAction,
} from "@/lib/audit/actions";
import { issuePath, projectPath } from "@/lib/nav";
import { useTimeAgo } from "@/lib/utils/useTimeAgo";
import styles from "./auditLog.module.scss";

interface Props {
  entries: AuditEntry[];
  title: string;
  description: string;
  /** Um das Kürzel eines Issues zu verlinken (`TargetLabel`). Ohne sie — die
   * Plattform-Übersicht spannt über alle Workspaces — bleibt es reiner Text. */
  workspaceSlug?: string;
  /** Id des letzten anfangs geladenen Eintrags — `null`, wenn `entries` schon
   * alles ist. Steuert, ob überhaupt nachgeladen wird. */
  nextCursor: string | null;
  /** Lädt die nächste Seite ab einem Cursor — eine an Workspace bzw. Projekt
   * gebundene Server Function (`loadMoreWorkspaceActivity`/
   * `loadMoreProjectActivity` in `features/audit/actions.ts`). */
  loadMore: (cursor: string) => Promise<ActivityPage>;
}

/**
 * Wie ein Vorgang in der Liste erscheint: sein Zeichen, seine Beschriftung, und
 * ob er auffallen soll.
 *
 * Die Zeichen gruppieren, was zusammengehört — alles um den Zutritt trägt einen
 * Schlüssel, alles um Rechte ein Schild, alles Zerstörerische einen Papierkorb,
 * der Notfall-Zugriff sein eigenes Zeichen, und alles Alltägliche (Projekte,
 * Mitglieder, Issues, Labels — Projekt- und Workspace-Aktivität, nicht nur
 * Plattform-Verwaltung) ein neutrales Plus/Minus.
 *
 * `message` ist der Name in `messages/*.json` und **nicht** der Schlüssel des
 * Vorgangs. Der trägt Punkte, und next-intl liest einen Punkt als
 * Verschachtelung: `audit.action.auth.login` wäre ein Objekt `auth` mit einem
 * Feld `login` — und `auth.login.failed` verlangte, dass `login` gleichzeitig
 * Text und Objekt ist. Die Nachrichten heißen deshalb flach, und diese Tabelle
 * ist die Brücke zwischen beiden Welten.
 *
 * `satisfies Record<AuditAction, …>` ist die eigentliche Absicherung: ein neuer
 * Vorgang in `lib/audit/actions.ts` bricht hier den Typecheck, bis er auch ein
 * Zeichen und eine Beschriftung hat.
 */
export const AUDIT_ACTION_META = {
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
  "mail.template.updated": {
    icon: "lucide:mail",
    message: "mailTemplateUpdated",
  },
  "mail.template.reset": {
    icon: "lucide:mail-x",
    message: "mailTemplateReset",
  },
  "project.created": { icon: "lucide:folder-plus", message: "projectCreated" },
  "project.visibility.changed": {
    icon: "lucide:eye",
    message: "projectVisibilityChanged",
  },
  "member.added": { icon: "lucide:user-plus", message: "memberAdded" },
  "member.removed": { icon: "lucide:user-minus", message: "memberRemoved" },
  "project.member.added": {
    icon: "lucide:user-plus",
    message: "projectMemberAdded",
  },
  "project.member.removed": {
    icon: "lucide:user-minus",
    message: "projectMemberRemoved",
  },
  "project.member.role.changed": {
    icon: "lucide:shield-check",
    message: "projectMemberRoleChanged",
  },
  "issue.created": { icon: "lucide:circle-plus", message: "issueCreated" },
  "issue.deleted": { icon: "lucide:circle-x", message: "issueDeleted" },
  "issue.assigned": { icon: "lucide:user-check", message: "issueAssigned" },
  "issue.unassigned": {
    icon: "lucide:user-round-x",
    message: "issueUnassigned",
  },
  "issue.title.changed": {
    icon: "lucide:pencil",
    message: "issueTitleChanged",
  },
  "issue.description.changed": {
    icon: "lucide:file-text",
    message: "issueDescriptionChanged",
  },
  "issue.status.changed": {
    icon: "lucide:git-branch",
    message: "issueStatusChanged",
  },
  "issue.priority.changed": {
    icon: "lucide:flag",
    message: "issuePriorityChanged",
  },
  "issue.type.changed": { icon: "lucide:shapes", message: "issueTypeChanged" },
  "issue.labels.changed": { icon: "lucide:tag", message: "issueLabelsChanged" },
  "issue.shared": { icon: "lucide:link", message: "issueShared" },
  "issue.share.revoked": {
    icon: "lucide:link-2-off",
    message: "issueShareRevoked",
  },
  "label.created": { icon: "lucide:tag", message: "labelCreated" },
  "label.deleted": { icon: "lucide:tag", message: "labelDeleted" },
} as const satisfies Record<
  AuditAction,
  { icon: string; message: string; loud?: boolean }
>;

/** Was ein unbekannter Vorgang bekommt — ein Punkt und sonst nichts. */
const UNKNOWN_ICON = "lucide:dot";

function metaOf(action: string) {
  const known = toAuditAction(action);
  return known ? AUDIT_ACTION_META[known] : null;
}

function isLoud(action: string): boolean {
  const meta = metaOf(action);
  return meta !== null && "loud" in meta && meta.loud;
}

/**
 * Zeichen und Nachrichten-Schlüssel eines Vorgangs — für kompaktere Anzeigen
 * außerhalb der vollen Tabelle, etwa die Aktivitäts-Karte der Übersicht
 * (`ProjectProfileView`/`WorkspaceProfileView`). Die Übersetzung selbst bleibt
 * bei der aufrufenden Komponente: `t(\`audit.action.${message}\`)`.
 */
export function auditActionMeta(action: string) {
  const meta = metaOf(action);
  return { icon: meta?.icon ?? UNKNOWN_ICON, message: meta?.message ?? null };
}

/**
 * Zeigt ein Kürzel wie `MOB-1` als eigenes, schmales Label zum schnellen
 * Wiedererkennen des Tickets, und ein „Alt → Neu" nicht als gleichwertigen
 * Fließtext, sondern „Alt" gedämpft und „Neu" betont — die Zerlegung selbst
 * steht in `parseTargetLabel` (`lib/audit/actions.ts`), reine
 * Zeichenkettenarbeit ohne React.
 *
 * Drei Vorgänge bekommen zusätzlich ihre eigene Optik statt reinem Text, mit
 * den Daten aus `meta` (`features/issues/actions.ts` schreibt sie in genau
 * dieser Form): Status und Priorität mit ihrem Symbol (`StatusIcon`/
 * `PriorityIcon` — dieselben wie auf Board und Liste), Status zusätzlich in
 * seiner Farbe statt der neutralen Textfarbe. Labels als Chips wie überall
 * sonst in der App (`Label`), nicht als Text mit vorangestelltem `+`/`−` —
 * hinzugekommene gefüllt, entfernte durchgestrichen. Fehlt `meta` (Zeilen von
 * vor dieser Änderung), bleibt es beim reinen Text.
 */
/** Vorgänge, bei denen das Ziel selbst das Projekt ist — `text` ist hier
 * bereits der Projektname, kein „Alt → Neu". Der ganze Text wird zum Link. */
const PROJECT_IS_TARGET: ReadonlySet<string> = new Set([
  "project.created",
  "project.archived",
  "project.unarchived",
  "project.deleted",
  "project.owner.changed",
  "project.visibility.changed",
  "project.breakglass",
]);

/** Vorgänge, deren Ziel eine Person ist, die aber einem Projekt zugeordnet
 * bleibt — im Workspace-weiten Feed sonst nicht erkennbar, zu welchem
 * Projekt „Zum Projekt hinzugefügt" gehört. Bekommen einen eigenen Chip. */
const PROJECT_IS_CONTEXT: ReadonlySet<string> = new Set([
  "project.member.added",
  "project.member.removed",
  "project.member.role.changed",
]);

interface TargetLabelProps {
  text: string;
  action: string;
  meta?: unknown;
  /** Farbe der/des in `text` genannten Person, für einen Avatar neben „Neu" —
   * z. B. wer eine Aufgabe jetzt zugewiesen bekommen hat. */
  personColor?: string | null;
  /** Verlinkt das Kürzel zum Issue. Ohne sie steht es als reiner Text da. */
  workspaceSlug?: string;
  /** Aktuelles Projekt hinter `projectId` — für den Link bei
   * `PROJECT_IS_TARGET`/`PROJECT_IS_CONTEXT` (`lib/audit/index.ts`). */
  projectRef?: { slug: string; name: string } | null;
}

export function TargetLabel({
  text,
  action,
  meta,
  personColor,
  workspaceSlug,
  projectRef,
}: TargetLabelProps) {
  const { ref, before, after } = parseTargetLabel(text);
  if (!ref && !after) return null;

  const refNode = ref ? (
    workspaceSlug ? (
      <Link href={issuePath(workspaceSlug, ref)} className={styles.ref}>
        {ref}
      </Link>
    ) : (
      <span className={styles.ref}>{ref}</span>
    )
  ) : null;

  const projectLink =
    workspaceSlug && projectRef ? (
      <Link
        href={projectPath(workspaceSlug, projectRef.slug, "overview")}
        className={styles.projectRef}
      >
        <Icon icon="lucide:folder" width={11} />
        {projectRef.name}
      </Link>
    ) : null;

  if (PROJECT_IS_TARGET.has(action)) {
    return (
      <span className={styles.targetLabel}>
        {projectLink ?? <span className={styles.changeAfter}>{after}</span>}
      </span>
    );
  }

  if (action === "issue.labels.changed") {
    const labels = meta as LabelsChangeMeta | undefined;
    return (
      <span className={styles.targetLabel}>
        {refNode}
        {labels ? (
          <>
            {labels.added.map((l) => (
              <Label key={`+${l.id}`} size="xs" filled color={l.color}>
                {l.name}
              </Label>
            ))}
            {labels.removed.map((l) => (
              <Label
                key={`-${l.id}`}
                size="xs"
                color={l.color}
                className={styles.removedLabel}
              >
                {l.name}
              </Label>
            ))}
          </>
        ) : (
          after && <span className={styles.changeAfter}>{after}</span>
        )}
      </span>
    );
  }

  const priority =
    action === "issue.priority.changed"
      ? (meta as PriorityChangeMeta | undefined)
      : undefined;
  const status =
    action === "issue.status.changed"
      ? (meta as StatusChangeMeta | undefined)
      : undefined;

  return (
    <span className={styles.targetLabel}>
      {refNode}
      {before !== undefined && (
        <>
          <span
            className={styles.changeBefore}
            style={status?.fromColor ? { color: status.fromColor } : undefined}
          >
            {priority && <PriorityIcon priority={priority.from} size={13} />}
            {status && (
              <StatusIcon
                status={status.from}
                color={status.fromColor ?? undefined}
                size={13}
              />
            )}
            {before}
          </span>
          <Icon
            icon="lucide:arrow-right"
            width={11}
            className={styles.changeArrow}
          />
        </>
      )}
      {after && (
        <span
          className={styles.changeAfter}
          style={status?.toColor ? { color: status.toColor } : undefined}
        >
          {priority && <PriorityIcon priority={priority.to} size={13} />}
          {status && (
            <StatusIcon
              status={status.to}
              color={status.toColor ?? undefined}
              size={13}
            />
          )}
          {personColor && (
            <Avatar
              avatar={{ name: after, color: personColor }}
              shape="circle"
              size={16}
              fontSize={9}
            />
          )}
          {after}
        </span>
      )}
      {PROJECT_IS_CONTEXT.has(action) && projectLink}
    </span>
  );
}

/**
 * Das Protokoll: wer, wann, was — und woran.
 *
 * Es lässt sich nicht bearbeiten und nicht löschen; es gibt dafür keine Aktion,
 * weder hier noch im Server (`lib/audit/index.ts`). Zwei Filter, bewusst grob:
 * „alles"/„nur das Laute" als Schalter, und ein Vorgang-Filter, der nur zeigt,
 * was in dieser Liste überhaupt vorkommt — eine Auswahl aus lauter Vorgängen,
 * die gar nicht da sind, wäre nutzlos.
 *
 * Die Namen in den Zeilen sind die von damals, nicht die von heute — sie wurden
 * beim Schreiben eingefroren. Wer sein Konto umbenennt, ändert damit nicht, was
 * das Protokoll über ihn sagt.
 */
export function AuditLog({
  entries,
  title,
  description,
  workspaceSlug,
  nextCursor,
  loadMore,
}: Props) {
  const t = useTranslations();
  const timeAgo = useTimeAgo();
  const [loudOnly, setLoudOnly] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>("all");

  const { items, cursor, loading, sentinelRef } = useInfiniteScroll({
    initialItems: entries,
    initialCursor: nextCursor,
    loadMore: (cursor) =>
      loadMore(cursor).then((page) => ({
        items: page.entries,
        nextCursor: page.nextCursor,
      })),
  });

  const availableActions = useMemo(
    () => [...new Set(items.map((e) => e.action))],
    [items],
  );

  const rows = items
    .filter((e) => !loudOnly || isLoud(e.action))
    .filter((e) => actionFilter === "all" || e.action === actionFilter);

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
              <TargetLabel
                text={row.targetLabel}
                action={row.action}
                meta={row.meta}
                personColor={row.personColor}
                workspaceSlug={workspaceSlug}
                projectRef={row.projectRef}
              />
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
      cell: (row) => (
        <span className={styles.actor}>
          <Avatar
            avatar={
              row.actorColor
                ? {
                    name: actorDisplayName(row.actorLabel),
                    color: row.actorColor,
                  }
                : null
            }
            shape="circle"
            size={20}
            placeholder
            placeholderLabel={row.actorLabel}
          />
          <span className={styles.actorName}>{row.actorLabel}</span>
        </span>
      ),
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
        title={title}
        count={rows.length}
        description={description}
        actions={
          <>
            {availableActions.length > 1 && (
              <select
                className={styles.filterSelect}
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                aria-label={t("audit.filterAction")}
              >
                <option value="all">{t("audit.allActions")}</option>
                {availableActions.map((action) => (
                  <option key={action} value={action}>
                    {label(action)}
                  </option>
                ))}
              </select>
            )}
            <Chip
              type="filter"
              icon={<Icon icon="lucide:siren" width={14} />}
              selected={loudOnly}
              onClick={() => setLoudOnly((value) => !value)}
            >
              {t("audit.loudOnly")}
            </Chip>
          </>
        }
      />

      <div className={styles.content}>
        <Table
          fill
          variant="card"
          label={title}
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
          footer={
            cursor && <LoadMoreSentinel ref={sentinelRef} loading={loading} />
          }
        />
      </div>
    </>
  );
}
