import { toDoc } from "./doc";
import type { PMDoc, PMNode } from "./types";

/**
 * Flacht ein Dokument zu reinem Text ab — für die Volltextsuche
 * (`Issue.descriptionText`) und für Vorschauzeilen wie im Inbox-Verlauf.
 *
 * Die Spalte existiert nur, weil `contains` auf einer `Json`-Spalte nicht
 * arbeitet. Sie wird bei jedem Schreibvorgang neu aus dem Dokument abgeleitet
 * und ist nirgends die Quelle der Wahrheit.
 */

/** Knoten, die im Fließtext eine sichtbare Grenze ziehen. */
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

  // Chips tragen ihren Text in den Attributen — ohne sie fiele eine Erwähnung
  // aus der Suche heraus, obwohl sie sichtbar im Text steht.
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
 * Mehrfache Umbrüche fallen zu einem zusammen und die Ränder werden getrimmt —
 * für Suche und Vorschau zählt der Wortlaut, nicht die Gliederung.
 */
export function toPlainText(value: PMDoc | unknown): string {
  const doc = toDoc(value);
  return (doc.content ?? [])
    .map(nodeText)
    .join("")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Einzeilige Vorschau, an der Wortgrenze gekürzt. */
export function toPreview(value: PMDoc | unknown, max = 140): string {
  const text = toPlainText(value).replace(/\s+/g, " ");
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * Die IDs aller erwähnten Mitglieder — Grundlage für Benachrichtigungen, sobald
 * es sie gibt, und heute schon nützlich, um Erwähnungen zu zählen.
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
