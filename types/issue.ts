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
}
