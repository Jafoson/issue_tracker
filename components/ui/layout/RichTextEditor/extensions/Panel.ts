import { mergeAttributes, Node } from "@tiptap/core";
import panel from "../../../atoms/RichText/richText.module.scss";

/**
 * The colored callout block that Jira calls a "Panel" — info or warning.
 *
 * A block that contains other blocks: paragraphs, lists, whatever. The
 * symbol before it (ℹ / ⚠) lives in CSS, not in the document — that way it
 * stays automatically correct when the kind changes and never ends up in
 * the text content.
 */

export type PanelKind = "info" | "warning";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    panel: {
      /** Turns the block under the cursor into a panel — or back out of one. */
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
          // Already a panel of this kind? Then dissolve it again — the same
          // command toggles it back and forth, just like for quote and heading.
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
