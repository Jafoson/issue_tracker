// ─── Audit-Log: die Registry ──────────────────────────────────────────────────
//
// Reine Datendefinition — kein DB-Zugriff, kein `server-only`, keine Prisma-
// Importe. Dieselbe Trennung wie bei `lib/rbac`, und aus demselben Grund: die
// Oberfläche muss die Vorgänge benennen können, und eine Liste im Protokoll
// rendert im Browser. Läge das hier neben `db`, zöge ein `"use client"`-Modul
// den Prisma-Client ins Bündel — und der Build bräche mit „server-only".
//
// Geschrieben und gelesen wird nebenan in `lib/audit/index.ts`.
//
// Ein Protokoll beantwortet drei Fragen, und die Auswahl unten folgt genau
// ihnen: **Wer war wann da?** (`auth.*`) **Wer hat wem Rechte gegeben?**
// (`user.role.platform`, `member.role.changed`) **Wer hat etwas Großes gelöscht
// oder aufgebrochen?** (`project.deleted`, `workspace.deleted`,
// `project.breakglass`).
//
// Was hier nicht steht, steht mit Absicht nicht hier. Jede gelesene Seite zu
// protokollieren, erzeugt eine Menge, die niemand mehr durchsieht — und ein
// Protokoll, das niemand durchsieht, schützt niemanden. Aufgezeichnet wird, was
// Rechte verschiebt oder Daten vernichtet.

/**
 * Die Vorgänge, die protokolliert werden — Schlüssel und Klartext.
 *
 * Der Schlüssel steht in der Datenbank und ändert sich nie. Der Text hier ist
 * für die, die das Protokoll in der Datenbank lesen; die Beschriftung in der
 * Oberfläche kommt aus `messages/*.json`. Die beiden Namen sind **nicht**
 * dieselben: next-intl liest den Punkt als Verschachtelung, die Nachrichten
 * heißen deshalb flach, und die Brücke steht in `PlatformAudit`.
 */
export const AUDIT_ACTIONS = {
  "auth.login": "Angemeldet",
  "auth.login.failed": "Anmeldung fehlgeschlagen",
  "user.role.platform": "Plattform-Rolle geändert",
  "user.deactivated": "Konto stillgelegt",
  "user.reactivated": "Konto wieder freigegeben",
  "member.role.changed": "Rolle im Workspace geändert",
  "project.breakglass": "Notfall-Zugriff auf ein Projekt",
  "project.owner.changed": "Projekt neu zugeordnet",
  "project.archived": "Projekt stillgelegt",
  "project.unarchived": "Projekt wieder in Betrieb",
  "project.deleted": "Projekt gelöscht",
  "workspace.suspended": "Workspace gesperrt",
  "workspace.unsuspended": "Workspace entsperrt",
  "workspace.deleted": "Workspace gelöscht",
  "mail.template.updated": "Mail-Vorlage bearbeitet",
  "mail.template.reset": "Mail-Vorlage auf Standard zurückgesetzt",

  // ── Alltägliches in Projekt und Workspace ──────────────────────────────────
  //
  // Anders als der Rest dieser Liste sind das keine sicherheitsrelevanten
  // Vorgänge, sondern der Lebenszyklus dessen, womit Projekt- und
  // Workspace-Übersicht ihren Aktivitäts-Feed füllen (`features/audit`).
  // Anlegen/Entfernen für die meisten Objekte — bei Issues zusätzlich ein
  // grober Bearbeitungs-Verlauf (welcher Aspekt sich änderte, nicht wie:
  // kein Vorher/Nachher, das wäre ein Diff und kein Protokolleintrag).
  "project.created": "Projekt angelegt",
  "project.visibility.changed": "Sichtbarkeit geändert",
  "member.added": "Mitglied zum Workspace hinzugefügt",
  "member.removed": "Mitglied aus dem Workspace entfernt",
  "project.member.added": "Mitglied zum Projekt hinzugefügt",
  "project.member.removed": "Mitglied aus dem Projekt entfernt",
  "project.member.role.changed": "Rolle im Projekt geändert",
  "issue.created": "Aufgabe angelegt",
  "issue.deleted": "Aufgabe gelöscht",
  "issue.assigned": "Aufgabe zugewiesen",
  "issue.unassigned": "Zuweisung entfernt",
  "issue.title.changed": "Titel geändert",
  "issue.description.changed": "Beschreibung geändert",
  "issue.status.changed": "Status geändert",
  "issue.priority.changed": "Priorität geändert",
  "issue.type.changed": "Typ geändert",
  "issue.labels.changed": "Labels geändert",
  "label.created": "Label angelegt",
  "label.deleted": "Label gelöscht",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export const AUDIT_ACTION_KEYS = Object.keys(AUDIT_ACTIONS) as AuditAction[];

/**
 * Narrowt einen Schlüssel aus der Datenbank auf die bekannte Menge.
 *
 * Das Protokoll ist älter als jede Fassung der Oberfläche: darin können
 * Vorgänge stehen, die diese Fassung nicht mehr kennt (oder noch nicht). Die
 * Liste zeigt solche Zeilen dann roh statt sie zu verschlucken — eine
 * unbekannte Zeile im Protokoll ist eine Information, keine Störung.
 */
export function toAuditAction(value: string): AuditAction | null {
  return (AUDIT_ACTION_KEYS as string[]).includes(value)
    ? (value as AuditAction)
    : null;
}

/**
 * Woran gehandelt wurde. Bewusst eine kleine, offene Liste statt einer Relation
 * je Art: das Protokoll überlebt seine Ziele (siehe `prisma/schema.prisma`), es
 * kann also gar nicht auf sie zeigen.
 */
export type AuditTargetType =
  | "user"
  | "project"
  | "workspace"
  | "role"
  | "mailTemplate"
  | "issue"
  | "label";

export interface AuditTarget {
  type: AuditTargetType;
  id: string;
  /** Wie das Ziel zur Tatzeit hieß. */
  label: string;
}

/**
 * Nur der Name aus `actorLabel` (das Format ist immer "Vorname Nachname
 * (E-Mail)") — der Avatar braucht die Initialen, nicht die Adresse in Klammern
 * dahinter. Eine getippte Adresse ohne Konto (fehlgeschlagene Anmeldung) trägt
 * ohnehin keine Klammer und kommt unverändert durch.
 */
export function actorDisplayName(actorLabel: string): string {
  return actorLabel.replace(/\s*\([^)]*\)\s*$/, "");
}

/** Ein Kürzel wie `MOB-1` am Anfang von `targetLabel` — Issue-Vorgänge
 * (`features/issues/actions.ts#issueRef`), gefolgt von `: ` und optional
 * einem „Alt → Neu". */
const REF_PATTERN = /^([A-Z0-9]{1,4}-\d+)(?:: ([\s\S]*))?$/;

export interface ParsedTargetLabel {
  /** Das Kürzel, falls `targetLabel` damit beginnt — sonst `undefined`. */
  ref?: string;
  /** Der alte Wert, wenn der Rest ein „Alt → Neu" ist. */
  before?: string;
  /** Der neue Wert (bei „Alt → Neu") oder der ganze Rest ohne Kürzel. */
  after?: string;
}

/**
 * Zerlegt `targetLabel` in Kürzel, Vorher und Nachher — für eine Anzeige, die
 * nicht als ein ununterscheidbarer Fließtext daherkommt (`TargetLabel` in
 * `features/audit/components/AuditLog/AuditLog.tsx`). Reine Zeichenkettenarbeit,
 * bewusst getrennt von der React-Komponente: so lässt sie sich prüfen, ohne
 * etwas zu rendern.
 */
export function parseTargetLabel(text: string): ParsedTargetLabel {
  const match = text.match(REF_PATTERN);
  const ref = match?.[1];
  const rest = match ? match[2] : text;
  if (!rest) return { ref };

  const arrowIdx = rest.indexOf(" → ");
  if (arrowIdx === -1) return { ref, after: rest };
  return {
    ref,
    before: rest.slice(0, arrowIdx),
    after: rest.slice(arrowIdx + 3),
  };
}

/**
 * Eine Zeile des Protokolls, wie die Oberfläche sie bekommt.
 *
 * Steht hier und nicht bei der Abfrage, weil die Liste sie als Prop erhält und
 * im Browser rendert — der Typ muss also von dort erreichbar sein, ohne den
 * Server-Teil mitzuziehen.
 */
export interface AuditEntry {
  id: string;
  createdAt: Date;
  action: string;
  actorId: string | null;
  actorLabel: string;
  /** Kontofarbe zur Tatzeit, für den Avatar — `null` ohne Konto (fehlgeschlagene
   * Anmeldung) oder wenn es inzwischen gelöscht ist. */
  actorColor: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  /** Kontofarbe der Person in `targetLabel`, wenn das Ziel selbst keine ist
   * (z. B. die/der Zugewiesene bei einem Issue) — sonst `null`. */
  personColor: string | null;
  workspaceId: string | null;
  projectId: string | null;
  reason: string | null;
  /**
   * Rohdaten je nach Vorgang — bei den meisten Zeilen ungenutzt. Bei Status-,
   * Prioritäts- und Labelwechsel eines Issues trägt es Render-Hinweise (Icon,
   * Farbe), die `TargetLabel` ausliest — siehe `PriorityChangeMeta`,
   * `StatusChangeMeta`, `LabelsChangeMeta`. Ungeprüft: geschrieben wird es nur
   * von `features/issues/actions.ts`, in genau dieser Form.
   */
  meta: unknown;
  /**
   * Slug und Name des Projekts hinter `projectId`, live nachgeschlagen wie
   * `actorColor` in `withCurrentColor` (`lib/audit/index.ts`) — nicht
   * eingefroren, weil es nur für einen Link taugen muss, nicht für
   * Zeitzeugenschaft. `null` ohne `projectId` oder wenn das Projekt inzwischen
   * gelöscht ist; die Zeile bleibt dann unverlinkter Text.
   */
  projectRef: { slug: string; name: string } | null;
}

/** `meta` bei `issue.priority.changed` — Prioritäts-Id reicht, das Symbol
 * kommt aus `PriorityIcon` (feste Zuordnung, keine Farbe nötig). */
export interface PriorityChangeMeta {
  from: number;
  to: number;
}

/** `meta` bei `issue.status.changed` — Farbe eingefroren wie `actorColor`,
 * weil `Status.color` sich ändern kann. */
export interface StatusChangeMeta {
  from: string;
  to: string;
  fromColor: string | null;
  toColor: string | null;
}

export interface LabelChangeItem {
  id: string;
  name: string;
  color: string;
}

/** `meta` bei `issue.labels.changed`. */
export interface LabelsChangeMeta {
  added: LabelChangeItem[];
  removed: LabelChangeItem[];
}
