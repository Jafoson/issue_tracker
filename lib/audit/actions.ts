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
export type AuditTargetType = "user" | "project" | "workspace" | "role";

export interface AuditTarget {
  type: AuditTargetType;
  id: string;
  /** Wie das Ziel zur Tatzeit hieß. */
  label: string;
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
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  workspaceId: string | null;
  projectId: string | null;
  reason: string | null;
}
