// ─── RBAC: Permissions & Default-Rollen ───────────────────────────────────────
//
// Diese Datei ist reine Datendefinition — kein DB-Zugriff, kein `server-only`.
// Sie wird sowohl von der Runtime (lib/permissions.ts), vom Seed (prisma/seed.ts)
// als auch von der Provisionierung neuer Workspaces (features/workspaces/actions.ts)
// importiert. Permission-Strings sind hardcoded: neue Permissions erfordern einen
// Code-Deploy, neue Rollen nicht (die liegen pro Workspace in der DB).

/**
 * Alle Permission-Keys. Die Reihenfolge ist die Seed-Reihenfolge der
 * `Permission`-Tabelle und gleichzeitig die Quelle für den `Permission`-Typ.
 */
export const ALL_PERMISSIONS = [
  // Workspace-Verwaltung
  "workspace.settings.update",
  "workspace.delete",
  "workspace.role.manage",
  "workspace.config.manage",
  "workspace.audit.view",
  // Mitglieder
  "workspace.member.invite",
  "workspace.member.remove",
  "workspace.member.role.update",
  // Projekte
  "workspace.project.create",
  // Teams
  "workspace.team.create",
  "workspace.team.update",
  "workspace.team.delete",
  "workspace.team.member.manage",
  "workspace.team.project.manage",
  // Workspace-Labels
  "workspace.label.create",
  "workspace.label.update",
  "workspace.label.delete",
  // Projekt-Verwaltung
  "project.view",
  "project.settings.update",
  "project.delete",
  "project.member.manage",
  // Issues
  "project.issue.create",
  "project.issue.update.any",
  "project.issue.update.own",
  "project.issue.delete.any",
  "project.issue.delete.own",
  "project.issue.assign",
  // Kommentare
  "project.comment.create",
  "project.comment.delete.any",
  "project.comment.delete.own",
  // Projekt-Labels
  "project.label.create",
  "project.label.update",
  "project.label.delete",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

/** Menschlich lesbare Beschreibung je Permission (wird in die DB geseedet). */
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  "workspace.settings.update": "Name, Farbe, Slug des Workspace ändern",
  "workspace.delete": "Workspace unwiderruflich löschen",
  "workspace.role.manage": "Rollen definieren und Permissions zuweisen",
  "workspace.config.manage":
    "Status, Prioritäten, Issue-Typen workspace-weit verwalten",
  "workspace.audit.view": "Audit-Log einsehen",
  "workspace.member.invite": "Einladungen an neue Mitglieder versenden",
  "workspace.member.remove": "Mitglieder aus dem Workspace entfernen",
  "workspace.member.role.update": "Rolle eines anderen Mitglieds ändern",
  "workspace.project.create": "Neues Projekt im Workspace anlegen",
  "workspace.team.create": "Team erstellen",
  "workspace.team.update": "Team-Name, Farbe und Lead ändern",
  "workspace.team.delete": "Team löschen",
  "workspace.team.member.manage":
    "Mitglieder zu Teams hinzufügen oder entfernen",
  "workspace.team.project.manage": "Projekte Teams zuordnen oder entfernen",
  "workspace.label.create": "Workspace-weites Label anlegen",
  "workspace.label.update": "Workspace-Label bearbeiten",
  "workspace.label.delete": "Workspace-Label löschen",
  "project.view": "Projekt sehen (relevant für private Projekte)",
  "project.settings.update": "Projektname, Präfix und Farbe ändern",
  "project.delete": "Projekt löschen",
  "project.member.manage": "Projekt-spezifische Rollen vergeben (inkl. Guests)",
  "project.issue.create": "Issue im Projekt erstellen",
  "project.issue.update.any": "Beliebige Issues bearbeiten",
  "project.issue.update.own":
    "Nur eigene Issues bearbeiten (Reporter oder Assignee)",
  "project.issue.delete.any": "Beliebige Issues löschen",
  "project.issue.delete.own": "Nur eigene Issues löschen",
  "project.issue.assign": "Issues anderen Mitgliedern zuweisen",
  "project.comment.create": "Kommentar zu einem Issue schreiben",
  "project.comment.delete.any": "Beliebige Kommentare löschen",
  "project.comment.delete.own": "Nur eigene Kommentare löschen",
  "project.label.create": "Projekt-spezifisches Label anlegen",
  "project.label.update": "Projekt-Label bearbeiten",
  "project.label.delete": "Projekt-Label löschen",
};

// ─── Wiederverwendbare Permission-Bündel ──────────────────────────────────────

const ALL_PROJECT_PERMISSIONS: Permission[] = [
  "project.view",
  "project.settings.update",
  "project.delete",
  "project.member.manage",
  "project.issue.create",
  "project.issue.update.any",
  "project.issue.update.own",
  "project.issue.delete.any",
  "project.issue.delete.own",
  "project.issue.assign",
  "project.comment.create",
  "project.comment.delete.any",
  "project.comment.delete.own",
  "project.label.create",
  "project.label.update",
  "project.label.delete",
];

// ─── Default-Rollen ───────────────────────────────────────────────────────────
//
// `key` ist die stabile, code-referenzierbare ID (= WorkspaceMember.role und
// ProjectMember.role). `rank` bildet die Hierarchie ab und steuert die
// „max. eigene Rolle vergebbar"-Regel. `editable: false` schützt den Owner.

export interface DefaultRole {
  key: string;
  name: string;
  desc: string;
  rank: number;
  editable: boolean;
  permissions: Permission[];
}

export const DEFAULT_ROLES: DefaultRole[] = [
  {
    key: "owner",
    name: "Owner",
    desc: "Workspace-Ersteller. Unveränderlich. Einziger mit Ownership-Transfer und Workspace-Delete.",
    rank: 6,
    editable: false,
    permissions: [...ALL_PERMISSIONS],
  },
  {
    key: "admin",
    name: "Admin",
    desc: "Vollzugriff. Verwaltet Rollen und Permissions, aber keine Ownership-Operationen.",
    rank: 5,
    editable: true,
    permissions: ALL_PERMISSIONS.filter((p) => p !== "workspace.delete"),
  },
  {
    key: "manager",
    name: "Manager",
    desc: "Verwaltet Workspace-Einstellungen, Mitglieder, Teams und Konfiguration. Kein Rollen/Permissions-Schema.",
    rank: 4,
    editable: true,
    permissions: ALL_PERMISSIONS.filter(
      (p) => p !== "workspace.delete" && p !== "workspace.role.manage",
    ),
  },
  {
    key: "project_lead",
    name: "Project Lead",
    desc: "Vollzugriff auf zugewiesene Projekte. Kann eigene Projekte erstellen. Kein Workspace-Zugriff.",
    rank: 3,
    editable: true,
    permissions: [
      "workspace.project.create",
      "workspace.label.create",
      "workspace.label.update",
      ...ALL_PROJECT_PERMISSIONS,
    ],
  },
  {
    key: "member",
    name: "Member",
    desc: "Standardrolle. Erstellt und bearbeitet eigene Issues, kommentiert, erstellt Labels.",
    rank: 2,
    editable: true,
    permissions: [
      "workspace.label.create",
      "project.view",
      "project.issue.create",
      "project.issue.update.own",
      "project.issue.delete.own",
      "project.issue.assign",
      "project.comment.create",
      "project.comment.delete.own",
      "project.label.create",
      "project.label.update",
    ],
  },
  {
    key: "viewer",
    name: "Viewer",
    desc: "Workspace-Mitglied mit Lesezugriff. Kann kommentieren, aber keine Issues erstellen.",
    rank: 1,
    editable: true,
    permissions: [
      "project.view",
      "project.comment.create",
      "project.comment.delete.own",
    ],
  },
  {
    key: "guest",
    name: "Guest",
    desc: "Kein Workspace-Mitglied. Nur zu einzelnen Projekten eingeladen. Sieht nur zugewiesene Projekte.",
    rank: 0,
    editable: true,
    permissions: [
      "project.view",
      "project.comment.create",
      "project.comment.delete.own",
    ],
  },
];

/** Rang einer Rolle (für die „max. eigene Rolle vergebbar"-Regel). Unbekannt → -1. */
export function roleRank(key: string): number {
  return DEFAULT_ROLES.find((r) => r.key === key)?.rank ?? -1;
}
