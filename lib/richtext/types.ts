/**
 * ProseMirror-Dokumente, wie sie in der Datenbank liegen.
 *
 * Bewusst eine eigene, schmale Beschreibung statt der Typen aus `@tiptap/pm`:
 * die Anzeige (`RichText`) läuft serverseitig und soll ProseMirror nicht einmal
 * als Typ-Import kennen. Nur der Editor zieht das Paket.
 */

/** Auszeichnung an einem Textknoten — fett, kursiv, Link, … */
export interface PMMark {
  type: string;
  attrs?: Record<string, unknown> | null;
}

export interface PMNode {
  type: string;
  attrs?: Record<string, unknown> | null;
  content?: PMNode[];
  marks?: PMMark[];
  /** Nur an Knoten vom Typ `text`. */
  text?: string;
}

/** Wurzelknoten. `content` fehlt bei einem frisch geleerten Dokument. */
export interface PMDoc {
  type: "doc";
  content?: PMNode[];
}

/**
 * Die Knotentypen, die Editor und Anzeige gemeinsam kennen. Wer hier etwas
 * ergänzt, muss beide Seiten anfassen: die Extension im Editor und den
 * Zweig in `RichText`.
 */
export type ChipNodeType = "mention" | "issueLink" | "dateChip" | "emoji";

/** Attribute der Chips — die Anzeige liest sie, ohne den Editor zu laden. */
export interface MentionAttrs {
  id: string;
  label: string;
}

export interface IssueLinkAttrs {
  /** Menschenlesbarer Schlüssel, z.B. `ORB-42`. */
  identifier: string;
  /** Interne Issue-ID; kann fehlen, wenn das Issue gelöscht wurde. */
  id: string | null;
}

export interface DateChipAttrs {
  /** ISO-Datum ohne Zeit, z.B. `2026-08-14`. */
  date: string;
}

export interface EmojiAttrs {
  /** Kurzname ohne Doppelpunkte, z.B. `smile`. */
  name: string;
  /** Das Zeichen selbst — mitgespeichert, damit die Anzeige keine Tabelle braucht. */
  emoji: string;
}
