import type { Role, User } from "@/types";

/**
 * Wer beim Anlegen und beim Beitritt automatisch aufgenommen wird. Über den
 * Zugriff entscheidet allein `ProjectMember` — deshalb nimmt ein Wechsel auf
 * `private` niemandem etwas, er hält nur den Automatismus an.
 */
export type ProjectVisibility = "public" | "private";

/** Alles, was die Einstellungsseite eines Projekts rendert. */
export interface ProjectSettingsView {
  project: {
    id: string;
    name: string;
    slug: string;
    prefix: string;
    color: string;
    /** Leer, wenn niemand einen Satz dazu geschrieben hat. */
    desc: string;
    visibility: ProjectVisibility;
    issueCount: number;
    memberCount: number;
  };
  /** `project.update` — Name, Kürzel, Farbe, Sichtbarkeit. */
  canUpdate: boolean;
  /** `project.delete` — das Projekt mit allen Issues löschen. */
  canDelete: boolean;
}

/**
 * Woher die Rolle stammt, mit der jemand im Projekt steht:
 * `project` = eigene Projektrolle aus `ProjectMember`, der Normalfall.
 * `workspace` = ohne Projekt-Eintrag drin, weil die Workspace-Rolle jedes Projekt
 * sieht (Owner, Admin) — die einzige verbliebene Quelle neben der Projektrolle.
 */
export type ProjectAccessSource = "project" | "workspace";

export interface ProjectMemberRow {
  user: User;
  /** Rollen-Key, der in diesem Projekt tatsächlich gilt. */
  role: string;
  /** Aufgelöster Anzeigename der Rolle — die UI braucht keine Lookup-Tabelle. */
  roleName: string;
  /** Rang der Rolle, für die Einfärbung. Kommt aus der Datenbank. */
  roleRank: number;
  source: ProjectAccessSource;
  /**
   * Nur bei `source: "project"`: ob die Rolle von einem Projektleiter gesetzt
   * wurde oder von einem Team übernommen ist (`ProjectMember.origin`). Eine
   * `team`-Zeile lässt sich wie jede andere ändern — das Setzen macht sie
   * dauerhaft `manual`, siehe `setProjectMemberRole`.
   */
  origin?: "manual" | "team";
  /** Nur bei `origin: "team"`: welches Team die Rolle zuletzt begründet hat. */
  originTeam?: { id: string; name: string; color: string };
  /** Die Workspace-Einladung wurde noch nicht angenommen. */
  pending: boolean;
  /** Das ist der gerade eingeloggte User — die Zeile markiert sich selbst. */
  you: boolean;
  /**
   * Der aktuelle User darf diese Zeile anfassen: Rang, Selbstbezug und die
   * Leitung des Workspace stehen nicht im Weg. Wird serverseitig entschieden —
   * die Rangfolge der Rollen gehört nicht in den Client.
   *
   * Ob die konkrete Aktion erlaubt ist, sagen `canSetRole` und `canRemove` der
   * Ansicht: die drei `member.*`-Rechte sind getrennt vergebbar, also darf die
   * Oberfläche sie nicht in einem Flag zusammenwerfen.
   */
  manageable: boolean;
}

/** Alles, was die Mitglieder-Seite eines Projekts rendert. */
export interface ProjectMembersView {
  rows: ProjectMemberRow[];
  /**
   * Workspace-Mitglieder ohne eigenen Projekt-Eintrag — die Vorschlagsliste im
   * Hinzufügen-Dialog. Enthält auch die, die (noch) gar keinen Zugriff auf das
   * Projekt haben und deshalb in `rows` fehlen. Leer ohne `member.invite`: ohne
   * das Recht gibt es niemanden hinzuzufügen, also auch nichts vorzuschlagen.
   */
  candidates: User[];
  /** Rollen, die der aktuelle User vergeben darf. Leer ohne Verwaltungsrecht. */
  assignableRoles: Role[];
  /** Vorauswahl im Hinzufügen-Dialog. */
  defaultRole: string;
  /** `member.invite` — Mitglieder ins Projekt aufnehmen oder einladen. */
  canAdd: boolean;
  /** `member.role.update` — die Projektrolle eines Mitglieds ändern. */
  canSetRole: boolean;
  /** `member.remove` — jemanden aus dem Projekt nehmen. */
  canRemove: boolean;
  /** Darf per E-Mail einladen. Hängt am selben Recht wie `canAdd`. */
  canInvite: boolean;
  /**
   * Offset in die zusammengesetzte Liste (Projekt- und geerbte
   * Workspace-Mitglieder), als String — `null`, wenn `rows` schon alles ist.
   * Kein Datenbank-Cursor: die Liste entsteht aus zwei vollständig gelesenen
   * Quellen im Speicher (`getProjectMembersView`), nicht aus einer einzigen
   * Abfrage, die sich an einer Id fortsetzen ließe.
   */
  nextCursor: string | null;
}

/** Ein Label, wie die Verwaltungsseite eines Projekts es zeigt. */
export interface ProjectLabelRow {
  id: string;
  name: string;
  /** Steht so in den Filter-URLs (`?label=…`) und bleibt beim Umbenennen. */
  slug: string;
  color: string;
  /**
   * Wie oft das Label in **diesem** Projekt an einem Issue hängt. Ein
   * Workspace-Label kann anderswo weiterlaufen — die Zahl sagt nur, was ein
   * Löschen hier sichtbar verändern würde.
   */
  issueCount: number;
  /**
   * In diesem Projekt ausgeblendet — es steht dann an keiner Aufgabe mehr zur
   * Auswahl. Nur für geerbte Labels von Belang; die eigenen löscht man.
   */
  hidden: boolean;
}

/** Alles, was die Label-Seite eines Projekts rendert. */
export interface ProjectLabelsView {
  /** Labels, die dem Projekt gehören. Nur sie lassen sich hier bearbeiten. */
  own: ProjectLabelRow[];
  /**
   * Workspace-Labels: gelten in jedem Projekt und lassen sich hier weder
   * umbenennen noch löschen — eine Umbenennung schlüge sonst in fremden
   * Projekten durch. Was dieses Projekt entscheiden darf, ist, ob es sie
   * überhaupt anbietet (`ProjectLabelRow.hidden`).
   */
  inherited: ProjectLabelRow[];
  /** `label.create` im Projekt-Scope. */
  canCreate: boolean;
  /** `label.update` im Projekt-Scope — bearbeitet die eigenen Labels und
   * entscheidet über das Ausblenden der geerbten. */
  canUpdate: boolean;
  /** `label.delete` im Projekt-Scope. */
  canDelete: boolean;
  /** Cursor für `own`, `null` wenn schon alles geladen ist. */
  ownNextCursor: string | null;
  /** Cursor für `inherited`, `null` wenn schon alles geladen ist. */
  inheritedNextCursor: string | null;
}
