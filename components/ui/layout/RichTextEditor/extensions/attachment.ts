import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AttachmentView } from "../components/AttachmentView/AttachmentView";

/**
 * Der Anhang-Knoten im Editor. Ein einziger Typ statt dreier — Bild, Video und
 * sonstige Datei unterscheiden sich nur in der Darstellung (`mimeType`), nicht
 * im Schema.
 *
 * Ein Inline-Atom statt eines Blocks — wie ein sehr breiter Chip. So fließen
 * mehrere kleine Bilder nebeneinander in einer Zeile statt dass jedes zwingend
 * eine eigene Zeile bekommt (`ATTACHMENT_IMAGE_DEFAULT_WIDTH` in
 * `lib/richtext/attachments.ts` hält sie dafür kompakt). Video und Datei
 * bleiben trotzdem block-artig — nicht über das Schema, sondern über CSS
 * (`display: block` in `attachmentView.module.scss`/`richText.module.scss`):
 * bei ihnen wäre ein Nebeneinander unpraktisch, aber ein zweites Schema nur
 * dafür unnötig.
 *
 * Persistiert werden **nur** `id` (als `data-id`) und `width` (als
 * `data-width`, vom Ziehgriff im Editor gesetzt) — `url`/`name`/`mimeType`/
 * `size` sind reine Laufzeit-Attribute, mit `renderHTML: () => ({})` bewusst
 * vom HTML-Export ausgenommen: eine presignte URL läuft nach einer Stunde ab,
 * sie über Kopieren/Einfügen weiterzutragen wäre sinnlos. Beim nächsten Laden
 * löst `withResolvedAttachments` (`lib/richtext/attachments.ts`) sie aus der
 * `Attachment`-Zeile frisch auf.
 */

export interface AttachmentOptions {
  /** Löscht die Anhang-Zeile serverseitig. `null` ⇒ kein Entfernen-Knopf
   *  (schreibgeschützte Anzeige). Das Hochladen selbst braucht keine Option
   *  hier — es läuft in `RichTextEditor.tsx` VOR dem Einfügen, der Knoten
   *  entsteht bereits mit den aufgelösten Attributen. */
  onRemove: ((id: string) => Promise<void>) | null;
}

export const AttachmentNode = Node.create<AttachmentOptions>({
  name: "attachment",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { onRemove: null };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-id"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.id ? { "data-id": String(attrs.id) } : {},
      },
      url: { default: null, renderHTML: () => ({}) },
      name: { default: "", renderHTML: () => ({}) },
      mimeType: { default: null, renderHTML: () => ({}) },
      size: { default: null, renderHTML: () => ({}) },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-width");
          const n = raw ? Number(raw) : Number.NaN;
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attrs: Record<string, unknown>) =>
          typeof attrs.width === "number"
            ? { "data-width": String(attrs.width) }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-chip="attachment"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-chip": "attachment" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentView);
  },
});
