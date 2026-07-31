import { mergeAttributes, Node } from "@tiptap/core";
import panel from "../../RichText/richText.module.scss";

/**
 * Der farbige Hinweisblock, den Jira „Panel" nennt — Info oder Warnung.
 *
 * Ein Block, der andere Blöcke enthält: Absätze, Listen, was auch immer. Das
 * Zeichen davor (ℹ / ⚠) steht im CSS, nicht im Dokument — so bleibt es beim
 * Wechsel der Art automatisch richtig und landet nicht im Fließtext.
 */

export type PanelKind = "info" | "warning";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    panel: {
      /** Setzt den Block unter dem Cursor in ein Panel — oder wieder heraus. */
      togglePanel: (kind: PanelKind) => ReturnType;
    };
  }
}

export const Panel = Node.create({
  name: "panel",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: "info" as PanelKind,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-kind") === "warning" ? "warning" : "info",
        renderHTML: (attrs: Record<string, unknown>) => ({
          "data-kind": String(attrs.kind ?? "info"),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "aside[data-kind]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "aside",
      mergeAttributes(HTMLAttributes, { class: panel.panel }),
      0,
    ];
  },

  addCommands() {
    return {
      togglePanel:
        (kind) =>
        ({ commands, editor }) => {
          // Schon ein Panel dieser Art? Dann wieder auflösen — derselbe Befehl
          // schaltet hin und zurück, wie bei Zitat und Überschrift auch.
          if (editor.isActive(this.name, { kind })) {
            return commands.lift(this.name);
          }
          if (editor.isActive(this.name)) {
            return commands.updateAttributes(this.name, { kind });
          }
          return commands.wrapIn(this.name, { kind });
        },
    };
  },
});
