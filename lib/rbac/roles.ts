// ─── RBAC: System-Rollen ──────────────────────────────────────────────────────
//
// Die Default-Rollen existieren **je genau einmal** in der Datenbank — ohne
// Bindung an einen Workspace oder ein Projekt. Alle Mandanten zeigen auf
// dieselben Zeilen. Das hält die Datenbank frei von Kopien und macht eine
// Änderung an einer Default-Rolle sofort überall wirksam.
//
// Der Preis, den das bewusst zahlt: eine System-Rolle ist nicht editierbar. Wer
// „Member, aber ohne Labels" braucht, legt im eigenen Workspace eine neue Rolle
// an (`role.manage`) — die hängt dann am Workspace bzw. am Projekt.
//
// `scope` sagt, wo eine Rolle vergeben werden kann; `rank` bildet innerhalb
// eines Scopes die Hierarchie ab und steuert die „höchstens die eigene Rolle
// vergebbar"-Regel.
//
// Gefragt wird die Ebene, um die es geht: im Projekt entscheidet die Projektrolle
// (sie ersetzt dort die Workspace-Rolle), im Workspace die Workspace-Rolle. Ein
// DENY sticht über alle Ebenen — es ist das einzige Mittel, das auch nach oben
// wirkt. Die Auswertung steht in `lib/permissions.ts`.
//
// Die erschöpfenden DENY-Listen der restriktiven Projektrollen stammen aus dem
// früheren Vereinigungsmodell und sind für die Herabstufung nicht mehr nötig —
// die leere ALLOW-Liste genügt. Sie bleiben, weil sie die Absicht ausdrücklich
// festhalten und ein workspaceweites Recht auch dann sperren, wenn es später neu
// dazukommt.

import { type Permission, permissionsFor, type RoleScope } from "./permissions";

export interface SystemRole {
  key: string;
  scope: RoleScope;
  name: string;
  desc: string;
  rank: number;
  allow: Permission[];
  deny: Permission[];
}

const PLATFORM_PERMS = permissionsFor("PLATFORM");
const WORKSPACE_PERMS = permissionsFor("WORKSPACE");
const PROJECT_PERMS = permissionsFor("PROJECT");

/** Alles aus `pool`, was nicht in `allow` steht — macht DENY-Listen erschöpfend. */
function complement(pool: Permission[], allow: Permission[]): Permission[] {
  const granted = new Set<Permission>(allow);
  return pool.filter((p) => !granted.has(p));
}

const READ_AND_COMMENT: Permission[] = [
  "project.view",
  "comment.create",
  "comment.delete.own",
];

const CONTRIBUTE: Permission[] = [
  "project.view",
  "issue.create",
  "issue.update.own",
  "issue.delete.own",
  "issue.assign",
  "comment.create",
  "comment.delete.own",
  "label.create",
  "label.update",
];

// ─── Scope PLATFORM ───────────────────────────────────────────────────────────
//
// Steht über allen Workspaces (SaaS-Betreiber). Zugriff auf Mandanteninhalte
// hängt allein an `tenant.access` — `platform_admin` hat sie bewusst NICHT. Wer
// fremde Issues sehen können soll, bekommt ausdrücklich `platform_support`.

const PLATFORM_ROLES: SystemRole[] = [
  {
    key: "platform_admin",
    scope: "PLATFORM",
    name: "Platform Admin",
    desc: "Verwaltet die Plattform: Benutzerkonten, Workspaces, globale Rollen. Kein Zugriff auf Inhalte der Workspaces.",
    rank: 2,
    allow: PLATFORM_PERMS.filter((p) => p !== "tenant.access"),
    deny: [],
  },
  {
    key: "platform_support",
    scope: "PLATFORM",
    name: "Platform Support",
    desc: "Darf zur Fehlersuche in alle Workspaces sehen und dort handeln. Keine Verwaltung von Konten oder Rollen.",
    rank: 1,
    allow: ["platform.access", "tenant.access"],
    deny: [],
  },
  {
    key: "platform_member",
    scope: "PLATFORM",
    name: "Platform Member",
    desc: "Normaler Benutzer ohne Plattform-Rechte. Standard für jedes neue Konto.",
    rank: 0,
    allow: [],
    deny: [],
  },
];

// ─── Scope WORKSPACE ──────────────────────────────────────────────────────────
//
// Diese Rollen dürfen auch projektbezogene Permissions tragen — die gelten dann
// als Basis in **allen** Projekten des Workspace. Die Projekt-Ebene ergänzt
// (ALLOW) oder entzieht (DENY) darauf.

const WORKSPACE_ROLES: SystemRole[] = [
  {
    key: "owner",
    scope: "WORKSPACE",
    name: "Owner",
    desc: "Workspace-Ersteller. Einziger mit dem Recht, den Workspace zu löschen.",
    rank: 6,
    allow: WORKSPACE_PERMS,
    deny: [],
  },
  {
    key: "admin",
    scope: "WORKSPACE",
    name: "Admin",
    desc: "Vollzugriff. Verwaltet Rollen und Berechtigungen, aber löscht den Workspace nicht.",
    rank: 5,
    allow: WORKSPACE_PERMS.filter((p) => p !== "workspace.delete"),
    deny: [],
  },
  {
    key: "manager",
    scope: "WORKSPACE",
    name: "Manager",
    desc: "Verwaltet Einstellungen, Mitglieder, Teams und Konfiguration. Keine Rollenverwaltung, kein Zugang zu privaten Projekten.",
    rank: 4,
    allow: WORKSPACE_PERMS.filter(
      (p) =>
        p !== "workspace.delete" &&
        p !== "role.manage" &&
        p !== "project.view.all",
    ),
    deny: [],
  },
  {
    key: "project_lead",
    scope: "WORKSPACE",
    name: "Project Lead",
    desc: "Voller Zugriff auf die Projekte des Workspace, inklusive deren Mitglieder. Keine Workspace-Verwaltung.",
    rank: 3,
    allow: [
      "project.create",
      "project.view",
      "project.update",
      "project.delete",
      "member.invite",
      "member.remove",
      "member.role.update",
      "label.create",
      "label.update",
      "label.delete",
      "issue.create",
      "issue.update.any",
      "issue.update.own",
      "issue.delete.any",
      "issue.delete.own",
      "issue.assign",
      "comment.create",
      "comment.delete.any",
      "comment.delete.own",
    ],
    deny: [],
  },
  {
    key: "member",
    scope: "WORKSPACE",
    name: "Member",
    desc: "Standardrolle. Erstellt Issues, bearbeitet die eigenen, kommentiert und legt Labels an.",
    rank: 2,
    allow: CONTRIBUTE,
    deny: [],
  },
  {
    key: "viewer",
    scope: "WORKSPACE",
    name: "Viewer",
    desc: "Lesezugriff auf den Workspace. Darf kommentieren, aber keine Issues erstellen.",
    rank: 1,
    allow: READ_AND_COMMENT,
    deny: [],
  },
  {
    key: "guest",
    scope: "WORKSPACE",
    name: "Guest",
    desc: "Von außen hinzugekommen. Sieht nur, wozu er ausdrücklich eingeladen wurde.",
    rank: 0,
    allow: READ_AND_COMMENT,
    deny: [],
  },
];

// ─── Scope PROJECT ────────────────────────────────────────────────────────────
//
// `project_viewer`, `project_guest` und `blocked` verbieten erschöpfend alles,
// was sie nicht erlauben. Das ist der Kern der Herabstufung: ohne DENY behielte
// ein Workspace-`project_lead` in diesem Projekt vollen Zugriff. Nebeneffekt:
// eine neu eingeführte Projekt-Permission ist für diese Rollen automatisch
// gesperrt und muss bewusst freigeschaltet werden.

const PROJECT_ROLES: SystemRole[] = [
  {
    key: "project_admin",
    scope: "PROJECT",
    name: "Project Admin",
    desc: "Voller Zugriff auf dieses Projekt inklusive Einstellungen, Mitglieder und projekteigener Rollen.",
    rank: 4,
    allow: PROJECT_PERMS,
    deny: [],
  },
  {
    key: "contributor",
    scope: "PROJECT",
    name: "Contributor",
    desc: "Arbeitet im Projekt mit: erstellt Issues, bearbeitet die eigenen, kommentiert.",
    rank: 3,
    allow: CONTRIBUTE,
    deny: [],
  },
  {
    key: "project_viewer",
    scope: "PROJECT",
    name: "Viewer",
    desc: "Liest mit und kommentiert. Alles Schreibende ist hier gesperrt — auch wenn die Workspace-Rolle mehr erlauben würde.",
    rank: 2,
    allow: READ_AND_COMMENT,
    deny: complement(PROJECT_PERMS, READ_AND_COMMENT),
  },
  {
    key: "project_guest",
    scope: "PROJECT",
    name: "Guest",
    desc: "Von außen zu genau diesem Projekt eingeladen. Rechte wie ein Viewer, ohne Workspace-Mitgliedschaft.",
    rank: 1,
    allow: READ_AND_COMMENT,
    deny: complement(PROJECT_PERMS, READ_AND_COMMENT),
  },
  {
    key: "blocked",
    scope: "PROJECT",
    name: "Blocked",
    desc: "Ausdrücklicher Ausschluss. Sperrt dieses Projekt auch für Mitglieder, die es über ihre Workspace-Rolle sehen dürften.",
    rank: 0,
    allow: [],
    deny: PROJECT_PERMS,
  },
];

/** Alle System-Rollen aller Scopes — genau diese Zeilen liegen in der Datenbank. */
export const SYSTEM_ROLES: SystemRole[] = [
  ...PLATFORM_ROLES,
  ...WORKSPACE_ROLES,
  ...PROJECT_ROLES,
];

/** Die System-Rollen eines Scopes. */
export function systemRolesIn(scope: RoleScope): SystemRole[] {
  return SYSTEM_ROLES.filter((r) => r.scope === scope);
}

/** Rolle, die jedes neue Konto bekommt. */
export const DEFAULT_PLATFORM_ROLE_KEY = "platform_member";
/** Rolle, die der Ersteller eines Workspace bekommt. */
export const OWNER_ROLE_KEY = "owner";
/** Workspace-Rolle für frisch Eingeladene, solange nichts anderes gewählt wird. */
export const DEFAULT_WORKSPACE_ROLE_KEY = "member";
/** Vorauswahl beim Aufnehmen in ein Projekt. */
export const DEFAULT_PROJECT_ROLE_KEY = "contributor";
/** Projektrolle für Gäste ohne Workspace-Mitgliedschaft. */
export const PROJECT_GUEST_ROLE_KEY = "project_guest";
/** Volle Kontrolle über ein Projekt. */
export const PROJECT_ADMIN_ROLE_KEY = "project_admin";
/** Lesen und kommentieren, sonst nichts. */
export const PROJECT_VIEWER_ROLE_KEY = "project_viewer";
/** Ausdrücklicher Ausschluss aus einem Projekt. */
export const PROJECT_BLOCKED_ROLE_KEY = "blocked";

/**
 * Farbe des Rollen-Punktes in der Oberfläche.
 *
 * Leitet sich vom Rang ab statt aus einer Tabelle je Schlüssel: so bekommen
 * auch selbst angelegte Rollen eine Farbe, die zu ihrer Machtfülle passt, ohne
 * dass jemand sie pflegen müsste.
 */
export function roleColor(rank: number): string {
  if (rank >= 5) return "var(--purple)"; // Owner, Admin — volle Verwaltung
  if (rank >= 3) return "var(--blue)"; // Manager, Project Lead
  if (rank === 2) return "var(--green)"; // der Normalfall
  if (rank <= 0) return "var(--amber)"; // Guest, Blocked — von außen oder gesperrt
  return "var(--outline)";
}
