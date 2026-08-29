import { toDoc } from "./doc";
import type { PMDoc, PMNode } from "./types";

/**
 * Flattens a document into plain text — for full-text search
 * (`Issue.descriptionText`) and for preview lines like in the inbox
 * history.
 *
 * This column only exists because `contains` doesn't work on a `Json`
 * column. It's re-derived from the document on every write and is never
 * the source of truth anywhere.
 */

/** Nodes that draw a visible boundary in running text. */
const BLOCKS = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "listItem",
  "taskItem",
  "panel",
  "tableRow",
  "horizontalRule",
]);

function nodeText(node: PMNode): string {
  if (node.type === "text") return node.text ?? "";

  // Chips carry their text in their attributes — without them, a mention
  // would fall out of search even though it's visibly present in the text.
  if (node.type === "mention") return `@${attr(node, "label")}`;
  if (node.type === "issueLink") return attr(node, "identifier");
  if (node.type === "linkChip")
    return attr(node, "label") || attr(node, "href");
  if (node.type === "dateChip") return attr(node, "date");
  if (node.type === "emoji") return attr(node, "emoji");
  if (node.type === "image") return attr(node, "alt");

  const inner = (node.content ?? []).map(nodeText).join("");
  return BLOCKS.has(node.type) ? `${inner}\n` : inner;
}

function attr(node: PMNode, key: string): string {
  const value = node.attrs?.[key];
  return typeof value === "string" ? value : "";
}

/**
 * Multiple consecutive line breaks collapse into one and the edges are
 * trimmed — for search and preview, the wording matters, not the layout.
 */
export function toPlainText(value: PMDoc | unknown): string {
  const doc = toDoc(value);
  return (doc.content ?? [])
    .map(nodeText)
    .join("")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Single-line preview, truncated at a word boundary. */
export function toPreview(value: PMDoc | unknown, max = 140): string {
  const text = toPlainText(value).replace(/\s+/g, " ");
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * The ids of all mentioned members — the basis for notifications once they
 * exist, and already useful today for counting mentions.
 */
export function mentionedUserIds(value: PMDoc | unknown): string[] {
  const ids = new Set<string>();
  const walk = (node: PMNode) => {
    if (node.type === "mention") {
      const id = attr(node, "id");
      if (id) ids.add(id);
    }
    node.content?.forEach(walk);
  };
  toDoc(value).content?.forEach(walk);
  return [...ids];
}
