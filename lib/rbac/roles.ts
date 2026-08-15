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
// Jeder Kontext löst genau eine Rolle auf: im Projekt die Projektrolle, im
// Workspace die Workspace-Rolle, auf der Plattform die Plattform-Rolle. Eine
// Workspace-Rolle trägt deshalb keine Issue- oder Kommentar-Rechte mehr — die
// Registry lässt das im Scope WORKSPACE gar nicht zu. Wer in den Projekten
// seines Workspace durchgreifen können muss, bekommt dafür `project.admin.all`.
// Die Auswertung steht in `lib/permissions.ts`.
//
// Eine Rolle listet nur, was sie erlaubt. Ein Gegenteil gibt es nicht: da jeder
// Kontext genau eine Rolle auflöst, ist „nicht aufgeführt" bereits das Verbot.

import { type Permission, permissionsFor, type RoleScope } from "./permissions";

export interface SystemRole {
  key: string;
  scope: RoleScope;
  name: string;
  desc: string;
  rank: number;
  allow: Permission[];
  /**
   * Nur für Workspace-Rollen: die Projektrolle, mit der ein Träger dieser Rolle
   * in ein Projekt des Workspace aufgenommen wird.
   *
   * Seit die Ebenen getrennt sind, lässt sich das nicht mehr aus den
   * Workspace-Rechten ableiten — dort steht über Issues und Kommentare nichts
   * mehr. Also wird es hier gesagt, statt es zu erraten
   * (`lib/project-membership.ts`).
   */
  defaultProjectRoleKey?: string;
}

const PLATFORM_PERMS = permissionsFor("PLATFORM");
const WORKSPACE_PERMS = permissionsFor("WORKSPACE");
const PROJECT_PERMS = permissionsFor("PROJECT");

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
  },
  {
    key: "platform_support",
    scope: "PLATFORM",
    name: "Platform Support",
    desc: "Darf zur Fehlersuche in alle Workspaces sehen und dort handeln. Keine Verwaltung von Konten oder Rollen.",
    rank: 1,
    allow: ["platform.access", "tenant.access"],
  },
  {
    key: "platform_member",
    scope: "PLATFORM",
    name: "Platform Member",
    desc: "Normaler Benutzer ohne Plattform-Rechte. Standard für jedes neue Konto.",
    rank: 0,
    allow: [],
  },
];

// ─── Scope WORKSPACE ──────────────────────────────────────────────────────────
//
// Diese Rollen tragen **nur** Workspace-Rechte: den Workspace selbst, seine
// Konfiguration, Teams, workspaceweite Labels, Mitglieder und Rollen. Über die
// Inhalte eines Projekts sagen sie nichts — dafür ist die Projektrolle da.
//
// Die Ausnahme sind die beiden Generalschlüssel. `project.admin.all` gibt volle
// Rechte in jedem Projekt, `project.view.all` nur Lesezugriff. Sie sind der Weg,
// die Leitung eines Workspace in ihren Projekten handlungsfähig zu halten, ohne
// die Trennung der Ebenen aufzuweichen — und sie sind unabhängig davon, ob
// jemand im Projekt eingetragen ist.
//
// `defaultProjectRoleKey` sagt, mit welcher Projektrolle ein Träger dieser Rolle
// in ein Projekt aufgenommen wird. Für die Generalschlüssel-Träger ist das nur
// noch Kosmetik in der Mitgliederliste; ihre Rechte hängen nicht daran.

const WORKSPACE_ROLES: SystemRole[] = [
  {
    key: "owner",
    scope: "WORKSPACE",
    name: "Owner",
    desc: "Workspace-Ersteller. Einziger mit dem Recht, den Workspace zu löschen. Hat in jedem Projekt alle Rechte.",
    rank: 6,
    allow: WORKSPACE_PERMS,
    defaultProjectRoleKey: "project_admin",
  },
  {
    key: "admin",
    scope: "WORKSPACE",
    name: "Admin",
    desc: "Vollzugriff. Verwaltet Rollen und Berechtigungen und hat in jedem Projekt alle Rechte, aber löscht den Workspace nicht.",
    rank: 5,
    allow: WORKSPACE_PERMS.filter((p) => p !== "workspace.delete"),
    defaultProjectRoleKey: "project_admin",
  },
  {
    key: "manager",
    scope: "WORKSPACE",
    name: "Manager",
    desc: "Verwaltet Einstellungen, Mitglieder, Teams und Konfiguration. Keine Rollenverwaltung, kein Durchgriff in die Projekte.",
    rank: 4,
    allow: WORKSPACE_PERMS.filter(
      (p) =>
        p !== "workspace.delete" &&
        p !== "role.manage" &&
        p !== "project.view.all" &&
        p !== "project.admin.all",
    ),
    defaultProjectRoleKey: "project_admin",
  },
  {
    key: "project_lead",
    scope: "WORKSPACE",
    name: "Project Lead",
    desc: "Voller Zugriff auf alle Projekte des Workspace, inklusive deren Mitglieder und Inhalte. Keine Workspace-Verwaltung.",
    rank: 3,
    allow: [
      "project.create",
      "project.view.all",
      "project.admin.all",
      "member.view",
      "member.invite",
      "member.remove",
      "member.role.update",
      "label.create",
      "label.update",
      "label.delete",
    ],
    defaultProjectRoleKey: "project_admin",
  },
  {
    key: "member",
    scope: "WORKSPACE",
    name: "Member",
    desc: "Standardrolle. Legt workspaceweite Labels an; was sie in einem Projekt darf, sagt die Projektrolle dort.",
    rank: 2,
    allow: ["label.create", "label.update"],
    defaultProjectRoleKey: "contributor",
  },
  {
    key: "viewer",
    scope: "WORKSPACE",
    name: "Viewer",
    desc: "Lesezugriff auf den Workspace. Wird in Projekten als Leser aufgenommen.",
    rank: 1,
    allow: [],
    defaultProjectRoleKey: "project_viewer",
  },
  {
    key: "guest",
    scope: "WORKSPACE",
    name: "Guest",
    desc: "Von außen hinzugekommen. Sieht nur, wozu er ausdrücklich eingeladen wurde.",
    rank: 0,
    allow: [],
    defaultProjectRoleKey: "project_viewer",
  },
];

// ─── Scope PROJECT ────────────────────────────────────────────────────────────
//
// Diese Rollen sind im Projekt die ganze Wahrheit: was hier nicht steht, gilt
// dort nicht. Eine neu eingeführte Projekt-Permission ist damit automatisch
// gesperrt, ohne dass jemand eine Verbotsliste pflegen muss.
//
// Wirkungslos sind sie allein gegenüber den Generalschlüsseln des Workspace:
// wer `project.admin.all` trägt, wird von `blocked` nicht ausgesperrt. Das ist
// Absicht — sonst könnte ein Project Admin die Leitung des Workspace aus deren
// eigenem Projekt aussperren, und niemand käme mehr an die Mitgliederverwaltung.

const PROJECT_ROLES: SystemRole[] = [
  {
    key: "project_admin",
    scope: "PROJECT",
    name: "Project Admin",
    desc: "Voller Zugriff auf dieses Projekt inklusive Einstellungen, Mitglieder und projekteigener Rollen.",
    rank: 4,
    allow: PROJECT_PERMS,
  },
  {
    key: "contributor",
    scope: "PROJECT",
    name: "Contributor",
    desc: "Arbeitet im Projekt mit: erstellt Issues, bearbeitet die eigenen, kommentiert.",
    rank: 3,
    allow: CONTRIBUTE,
  },
  {
    key: "project_viewer",
    scope: "PROJECT",
    name: "Viewer",
    desc: "Liest mit und kommentiert. Alles Schreibende ist in diesem Projekt gesperrt.",
    rank: 2,
    allow: READ_AND_COMMENT,
  },
  {
    key: "project_guest",
    scope: "PROJECT",
    name: "Guest",
    desc: "Von außen zu genau diesem Projekt eingeladen. Rechte wie ein Viewer, ohne Workspace-Mitgliedschaft.",
    rank: 1,
    allow: READ_AND_COMMENT,
  },
  {
    key: "blocked",
    scope: "PROJECT",
    name: "Blocked",
    desc: "Ausdrücklicher Ausschluss aus diesem Projekt. Wirkungslos gegen die Leitung des Workspace (project.admin.all).",
    rank: 0,
    allow: [],
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

/**
 * Die Projektrolle, mit der eine System-Workspace-Rolle in ein Projekt
 * aufgenommen wird — oder null für eine selbst angelegte Rolle, die hier
 * naturgemäß nicht steht.
 */
export function defaultProjectRoleKeyOf(
  workspaceRoleKey: string,
): string | null {
  const role = SYSTEM_ROLES.find(
    (r) => r.scope === "WORKSPACE" && r.key === workspaceRoleKey,
  );
  return role?.defaultProjectRoleKey ?? null;
}

/** Rolle, die jedes neue Konto bekommt. */
export const DEFAULT_PLATFORM_ROLE_KEY = "platform_member";
/** Verwaltet die Plattform — Stammdaten und Sperren jedes Workspace, kein Inhaltszugriff. */
export const PLATFORM_ADMIN_ROLE_KEY = "platform_admin";
/** Trägt `tenant.access` — Support-Durchgriff in jeden Workspace. */
export const PLATFORM_SUPPORT_ROLE_KEY = "platform_support";
/** Rolle, die der Ersteller eines Workspace bekommt. */
export const OWNER_ROLE_KEY = "owner";
/** Workspace-Rolle für frisch Eingeladene, solange nichts anderes gewählt wird. */
export const DEFAULT_WORKSPACE_ROLE_KEY = "member";
/** Lesezugriff auf den Workspace, ohne Mitarbeit. */
export const WORKSPACE_VIEWER_ROLE_KEY = "viewer";
/** Von außen zum Workspace hinzugekommen. */
export const WORKSPACE_GUEST_ROLE_KEY = "guest";
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
