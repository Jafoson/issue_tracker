import type { PMDoc } from "@/lib/richtext/types";

export interface Status {
  id: string;
  name: string;
  short: string;
  color: string;
  isColumn: boolean;
}

export interface Priority {
  id: number;
  key: string;
  name: string;
  color: string;
}

export interface Label {
  id: string;
  name: string;
  slug: string;
  color: string;
  projectId?: string | null;
  /**
   * Projekte, in denen dieses Workspace-Label nicht angeboten wird.
   *
   * Ausgeblendet wird in den Label-Einstellungen des Projekts. Wer eine Auswahl
   * baut, muss die Liste hier prüfen — an Aufgaben, die das Label schon tragen,
   * bleibt es sichtbar.
   */
  hiddenIn?: string[];
}

export interface IssueType {
  id: string;
  name: string;
  color: string;
}

export interface Comment {
  id: string;
  author: string;
  time: number;
  /** ProseMirror-Dokument — angezeigt von `components/ui/atoms/RichText`. */
  body: PMDoc;
}

/**
 * Ein Anhang, wie ihn die Detailansicht lädt — bereits aufgelöst: `url` ist
 * bei `kind: "file"` eine presignte S3-Adresse (eine Stunde gültig, bei jedem
 * Render frisch erzeugt), bei `kind: "link"` die extern eingetragene Adresse
 * unverändert. `null` heißt bei `kind: "file"`: Speicher nicht konfiguriert
 * oder Objekt fehlt.
 */
export interface IssueAttachment {
  id: string;
  kind: "file" | "link";
  name: string;
  url: string | null;
  mimeType: string | null;
  size: number | null;
  createdAt: number;
  authorId: string;
}

export interface Issue {
  id: string;
  key: number;
  title: string;
  status: string;
  priority: number;
  assignee: string | null;
  reporter: string;
  labels: string[];
  rank: number;
  created: number;
  updated: number;
  /** ProseMirror-Dokument — angezeigt von `components/ui/atoms/RichText`. */
  description: PMDoc;
  comments: Comment[];
  project: string;
  type: string;
  /** Absolute URL des öffentlichen Lese-Links, `null` wenn Teilen aus ist
   *  (`lib/issue-share.ts`). Fertig zusammengesetzt vom Server — der Client
   *  baut keine URLs, `lib/app-url.ts` liest Umgebungsvariablen, die im
   *  Browser nicht ankommen. */
  shareUrl: string | null;
}

/**
 * Was der aktuelle Benutzer mit diesem einen Issue darf — abhängig von Rolle
 * UND Eigentümerschaft (`issue.update.own`/`issue.delete.own` greifen nur für
 * Reporter/Assignee), deshalb je Issue berechnet statt aus der Rolle allein
 * ableitbar. Spiegelt genau die Prüfungen in `updateIssue`/`deleteIssue`
 * (`features/issues/actions.ts`) — die Detailansicht bietet keine Bedienung
 * an, die der Server ohnehin ablehnen würde.
 */
export interface IssueAccess {
  /** `issue.update.any` oder (`issue.update.own` und Reporter/Assignee). */
  canEdit: boolean;
  /** `canEdit` UND `issue.assign` — nur relevant, wenn `canEdit` schon gilt. */
  canAssign: boolean;
  /** `issue.delete.any` oder (`issue.delete.own` und Reporter/Assignee). */
  canDelete: boolean;
  /** `issue.share.manage` — öffentlichen Lese-Link erstellen/widerrufen. */
  canShare: boolean;
}

/** Ein Issue, wie es die Detailansicht (Panel, Dialog, Vollseite) lädt. */
export interface IssueDetail extends Issue {
  access: IssueAccess;
  attachments: IssueAttachment[];
}
