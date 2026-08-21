import type { PMDoc, PMNode } from "./types";

/** Attribute des `attachment`-Knotens, wie ihn Editor und Anzeige lesen. */
export interface AttachmentAttrs {
  id: string | null;
  url: string | null;
  name: string;
  mimeType: string | null;
  size: number | null;
  /** Breite in Pixeln, vom Ziehgriff im Editor gesetzt. `null` ⇒ Standardbreite. */
  width: number | null;
}

export const ATTACHMENT_IMAGE_MIN_WIDTH = 160;
export const ATTACHMENT_IMAGE_MAX_WIDTH = 720;
export const ATTACHMENT_IMAGE_DEFAULT_WIDTH = 320;

/**
 * Erzwingt eine Breite innerhalb des ziehbaren Bereichs — dieselbe Spanne für
 * den Ziehgriff im Editor (`AttachmentView`) und die Anzeige (`RichText`), so
 * dass ein gespeicherter Wert nie in beiden verschieden groß erscheint. Fehlt
 * die Breite (kein Attribut oder kein gültiger Zahlenwert), gilt der Standard.
 */
export function clampAttachmentWidth(width: unknown): number {
  const n =
    typeof width === "number" && Number.isFinite(width)
      ? width
      : ATTACHMENT_IMAGE_DEFAULT_WIDTH;
  return Math.min(
    ATTACHMENT_IMAGE_MAX_WIDTH,
    Math.max(ATTACHMENT_IMAGE_MIN_WIDTH, Math.round(n)),
  );
}

/** Was eine aufgelöste `Attachment`-Zeile für die Wiedergabe im Dokument beisteuert. */
export interface ResolvedAttachmentRef {
  url: string;
  name: string;
  mimeType: string | null;
  size: number | null;
}

/** Menschenlesbare Dateigröße — `RichText`, `AttachmentView` und die
 *  Anhänge-Sektion zeigen alle dasselbe Format, deshalb eine Stelle dafür. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

function mapAttachmentNodes(
  nodes: PMNode[] | undefined,
  fn: (
    attrs: Record<string, unknown> | null | undefined,
  ) => Record<string, unknown>,
): PMNode[] | undefined {
  if (!nodes) return nodes;
  return nodes.map((node) =>
    node.type === "attachment"
      ? { ...node, attrs: fn(node.attrs) }
      : node.content
        ? { ...node, content: mapAttachmentNodes(node.content, fn) }
        : node,
  );
}

/**
 * Lesepfad: reichert jeden `attachment`-Knoten um die aufgelöste URL, den
 * Namen, MIME-Typ und die Größe an — `byId` kommt aus den frisch geladenen
 * `Attachment`-Zeilen des Issues. Fehlt die Id in `byId` (gelöschter Anhang),
 * bleibt der Knoten ohne `url` stehen; Anzeige und Editor zeigen dafür einen
 * „Anhang entfernt"-Platzhalter statt eines toten Bildes.
 */
export function withResolvedAttachments(
  doc: PMDoc,
  byId: Record<string, ResolvedAttachmentRef>,
): PMDoc {
  return {
    ...doc,
    content: mapAttachmentNodes(doc.content, (attrs) => {
      const id = typeof attrs?.id === "string" ? attrs.id : null;
      const resolved = id ? byId[id] : undefined;
      return {
        id,
        url: resolved?.url ?? null,
        name: resolved?.name ?? "",
        mimeType: resolved?.mimeType ?? null,
        size: resolved?.size ?? null,
        // Anders als die übrigen Attribute keine Ableitung aus der
        // `Attachment`-Zeile, sondern eine Einstellung des Dokuments selbst
        // — bleibt deshalb aus dem ursprünglichen Knoten erhalten statt aus
        // `byId` zu kommen.
        width: typeof attrs?.width === "number" ? attrs.width : null,
      };
    }),
  };
}

/**
 * Schreibpfad: wirft an jedem `attachment`-Knoten die zur Anzeige
 * aufgelösten Attribute wieder ab, bevor `description` in die Datenbank
 * geschrieben wird — verteidigt gegen einen Client, der sie versehentlich mit
 * zurückschickt. Eine presignte URL läuft nach einer Stunde ab; sie zu
 * speichern wäre ohnehin sinnlos (wie bei Avataren, siehe `lib/storage`).
 *
 * `width` bleibt davon ausgenommen: anders als `url`/`name`/`mimeType`/`size`
 * ist es keine Ableitung aus der `Attachment`-Zeile, sondern eine echte
 * Einstellung des Dokuments (vom Ziehgriff im Editor gesetzt) — geht sie
 * verloren, springt das Bild beim nächsten Laden auf die Standardbreite
 * zurück.
 */
export function stripAttachmentAttrs(doc: PMDoc): PMDoc {
  return {
    ...doc,
    content: mapAttachmentNodes(doc.content, (attrs) => ({
      id: typeof attrs?.id === "string" ? attrs.id : null,
      width: typeof attrs?.width === "number" ? attrs.width : null,
    })),
  };
}
