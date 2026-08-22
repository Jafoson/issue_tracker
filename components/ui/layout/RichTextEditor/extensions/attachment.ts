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
    return ReactNodeViewRenderer(AttachmentView, {
      // `@tiptap/core`s Standard-`stopEvent` lässt ProseMirror ein natives
      // `dragstart` nur dann selbst verarbeiten, wenn `event.target` exakt
      // der äußere Node-View-Knoten ist. Das sichtbare, tatsächlich gezogene
      // Element ist bei uns aber immer eine Ebene tiefer (`<img>` in
      // `AttachmentView.tsx`) — jedes echte Ziehen verschluckt Tiptap damit
      // stillschweigend, ProseMirrors eigener `dragstart`-Handler (der
      // `view.dragging` fürs spätere Verschieben setzt) läuft nie. Ein Drop
      // fällt dann auf rohes HTML-Parsing zurück, das auf den `image`-Knoten
      // aus `RichTextEditor.tsx` trifft statt auf `attachment` — sichtbar als
      // zweiter, andersartiger Knoten, während der ursprüngliche liegen
      // bleibt oder unkontrolliert vom Browser selbst entfernt wird. Drag-
      // Ereignisse deshalb immer an ProseMirror durchreichen, unabhängig vom
      // genauen Ziel; für alles andere (Klick auf den Entfernen-Knopf etc.)
      // bleibt es bei der bisherigen Faustregel.
      stopEvent: ({ event }) => {
        if (event.type.startsWith("drag")) return false;
        const target = event.target as HTMLElement;
        return ["INPUT", "BUTTON", "SELECT", "TEXTAREA"].includes(
          target.tagName,
        );
      },
      // `@tiptap/react`s `ReactNodeView.update()` überspringt das Nachziehen
      // der eigenen, gecachten Position (`currentPos`), sobald ProseMirror
      // dieselbe Node-Objektreferenz weiterreicht (z.B. wenn nur Geschwister-
      // Inhalt vor dem Knoten sich ändert, ohne diesen Knoten selbst
      // anzufassen — genau das passiert nach einem Verschieben, sobald
      // irgendwo davor weitergetippt wird). Die Auswahl-Markierung
      // (`handleSelectionUpdate`) vergleicht danach gegen die falsche, alte
      // Position — ein Klick auf den (korrekt verschobenen) Anhang selektiert
      // ihn dann nicht mehr, die Ziehgriffe zum Vergrößern bleiben aus. Eine
      // eigene `update`-Funktion lässt Tiptap `currentPos` bei jedem Aufruf
      // aktualisieren.
      update: ({ updateProps }) => {
        updateProps();
        return true;
      },
    });
  },
});
