import type { PMDoc, PMNode } from "./types";

/**
 * An empty document. ProseMirror requires at least one paragraph — a `doc`
 * with no content at all can technically be saved, but the editor replaces
 * it immediately on load anyway. So this is already the canonical form.
 */
export const EMPTY_DOC: PMDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/** A fresh copy — otherwise every caller would share the same object. */
export function emptyDoc(): PMDoc {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/**
 * Detects documents that contain nodes but have nothing to display: a
 * single empty paragraph doesn't look empty in the database, but it is for
 * the reader. Decides whether the placeholder appears.
 */
export function isEmptyDoc(doc: PMDoc | null | undefined): boolean {
  if (!doc?.content?.length) return true;
  return doc.content.every(isEmptyNode);
}

function isEmptyNode(node: PMNode): boolean {
  // Atoms carry their content in their attributes, not in `content` — a
  // single image or a date chip isn't an empty document.
  if (node.type !== "paragraph") return false;
  if (!node.content?.length) return true;
  return node.content.every((child) => child.type === "text" && !child.text);
}

/**
 * Checks incoming JSON before it's rendered or saved. The column is
 * `Json` — Prisma returns whatever is in it, and that isn't necessarily a
 * document (a stale row, a failed migration, a manual edit).
 */
export function isPMDoc(value: unknown): value is PMDoc {
  if (typeof value !== "object" || value === null) return false;
  const doc = value as PMDoc;
  if (doc.type !== "doc") return false;
  return doc.content === undefined || Array.isArray(doc.content);
}

/**
 * The path from the database into the application: anything that isn't a
 * valid document becomes the empty document. Better an empty description
 * than a page that breaks on one issue's corrupted record.
 */
export function toDoc(value: unknown): PMDoc {
  return isPMDoc(value) ? value : emptyDoc();
}

/**
 * The path out of the editor: turns the document into a plain object.
 *
 * ProseMirror creates a node's attributes with `Object.create(null)`
 * (`computeAttrs` in prosemirror-model), and `Node.toJSON()` passes that
 * exact object along — with no prototype. React refuses to hand something
 * like that to a Server Function: `isSimpleObject` requires
 * `Object.prototype` somewhere in the chain, finds `null` instead, and
 * forwards a temporary reference in place of the data. Every access to it
 * then fails on the server — "Cannot access label on the server."
 *
 * Every node with attributes is affected: mention, issue, date, emoji,
 * heading (`level`), code block (`language`), panel (`kind`), checklist
 * item (`checked`), ordered list (`start`). Without this round-trip, none
 * of it would arrive intact in the database.
 *
 * The detour through JSON isn't lazy here, it's exactly right: the document
 * *is* JSON, and `JSON.parse` is guaranteed to produce objects with a
 * normal prototype.
 */
export function toPlainDoc(doc: PMDoc): PMDoc {
  return JSON.parse(JSON.stringify(doc));
}
