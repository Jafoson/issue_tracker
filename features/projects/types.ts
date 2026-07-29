import type { Role, User } from "@/types";

/**
 * Woher die Rolle stammt, mit der jemand im Projekt steht:
 * `project` = eigener `ProjectMember`-Eintrag, `workspace` = aus der
 * Workspace-Rolle geerbt (öffentliche Projekte, Owner und Admins).
 */
export type ProjectAccessSource = "project" | "workspace";

export interface ProjectMemberRow {
  user: User;
  /** Rollen-Key, der in diesem Projekt tatsächlich gilt. */
  role: string;
  /** Aufgelöster Anzeigename der Rolle — die UI braucht keine Lookup-Tabelle. */
  roleName: string;
  source: ProjectAccessSource;
  /** Die Workspace-Einladung wurde noch nicht angenommen. */
  pending: boolean;
  /** Das ist der gerade eingeloggte User — die Zeile markiert sich selbst. */
  you: boolean;
  /**
   * Der aktuelle User darf diese Zeile anfassen. Was das heißt, hängt an
   * `source`: bei `project` Rolle ändern und entfernen, bei `workspace` ins
   * Projekt übernehmen. Wird serverseitig entschieden — die Rangfolge der
   * Rollen gehört nicht in den Client.
   */
  manageable: boolean;
}

/** Alles, was die Mitglieder-Seite eines Projekts rendert. */
export interface ProjectMembersView {
  rows: ProjectMemberRow[];
  /**
   * Workspace-Mitglieder ohne eigenen Projekt-Eintrag — die Vorschlagsliste im
   * Hinzufügen-Dialog. Enthält auch die, die in privaten Projekten (noch) gar
   * keinen Zugriff haben und deshalb in `rows` fehlen.
   */
  candidates: User[];
  /** Rollen, die der aktuelle User vergeben darf. Leer ohne Verwaltungsrecht. */
  assignableRoles: Role[];
  /** Vorauswahl im Hinzufügen-Dialog. */
  defaultRole: string;
  canManage: boolean;
  /** Darf neue Accounts per E-Mail in den Workspace einladen. */
  canInvite: boolean;
}
