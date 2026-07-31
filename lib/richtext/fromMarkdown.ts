import { emptyDoc } from "./doc";
import type { PMDoc, PMMark, PMNode } from "./types";

/**
 * Markdown → ProseMirror-JSON.
 *
 * Zwei Aufgaben: die einmalige Umstellung der Bestandsdaten
 * (`scripts/migrate-richtext.ts`) und das Seed, das weiterhin bequem in
 * Markdown geschrieben wird.
 *
 * Die Grammatik ist absichtlich dieselbe wie im abgelösten `Markdown`-Renderer —
 * dieselben Ausdrücke, dieselbe Reihenfolge. Was Leserinnen und Leser vor der
 * Umstellung gesehen haben, kommt danach genauso heraus. Deshalb auch kein
 * `@tiptap/markdown`: das braucht ein DOM, läuft also in keinem Bun-Skript, und
 * ist von Tiptap selbst noch als "early release" gekennzeichnet.
 */

const FENCE = /^\s*```(\w*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const TASK = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

/** Reihenfolge zählt: längere Marker müssen vor ihren kürzeren Varianten stehen. */
const INLINE_PATTERN = [
  "(`[^`]+`)",
  "(\\*\\*[^]+?\\*\\*)",
  "(__[^]+?__)",
  "(~~[^]+?~~)",
  "(\\*[^*\\n]+?\\*)",
  "(_[^_\\n]+?_)",
  "(!?\\[[^\\]]*\\]\\([^)\\s]+\\))",
  "(https?://[^\\s<>()]+)",
].join("|");

const LINK = /^(!?)\[([^\]]*)\]\(([^)\s]+)\)$/;

function safeUrl(url: string): string | null {
  return /^(?:https?:\/\/|mailto:|\/|#)/i.test(url) ? url : null;
}

function isBlockStart(line: string): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    BULLET.test(line) ||
    ORDERED.test(line) ||
    QUOTE.test(line) ||
    RULE.test(line)
  );
}

function text(value: string, marks: PMMark[]): PMNode {
  const node: PMNode = { type: "text", text: value };
  if (marks.length) node.marks = marks;
  return node;
}

function withMark(marks: PMMark[], type: string): PMMark[] {
  return marks.some((m) => m.type === type) ? marks : [...marks, { type }];
}

/**
 * Zerlegt eine Zeile in Textknoten samt Auszeichnungen. Der Scanner wird pro
 * Aufruf neu gebaut, weil verschachtelte Auszeichnungen zurückspringen und sich
 * beide sonst die Suchposition der Regex teilen würden.
 */
function parseInline(source: string, marks: PMMark[] = []): PMNode[] {
  const scanner = new RegExp(INLINE_PATTERN, "g");
  const nodes: PMNode[] = [];
  let last = 0;
  let match = scanner.exec(source);

  const plain = (value: string) => {
    // Einzelne Umbrüche im Absatz waren im alten Renderer sichtbar (`pre-wrap`);
    // in ProseMirror ist das ein harter Umbruch.
    value.split("\n").forEach((part, index) => {
      if (index > 0) nodes.push({ type: "hardBreak" });
      if (part) nodes.push(text(part, marks));
    });
  };

  while (match) {
    if (match.index > last) plain(source.slice(last, match.index));
    nodes.push(...parseToken(match[0], marks));
    last = match.index + match[0].length;
    match = scanner.exec(source);
  }
  if (last < source.length) plain(source.slice(last));

  return nodes;
}

function parseToken(token: string, marks: PMMark[]): PMNode[] {
  if (token.startsWith("`")) {
    return [text(token.slice(1, -1), withMark(marks, "code"))];
  }
  if (token.startsWith("**") || token.startsWith("__")) {
    return parseInline(token.slice(2, -2), withMark(marks, "bold"));
  }
  if (token.startsWith("~~")) {
    return parseInline(token.slice(2, -2), withMark(marks, "strike"));
  }

  const link = LINK.exec(token);
  if (link) {
    const [, bang, label, target] = link;
    const url = safeUrl(target);
    // Unsichere Adressen bleiben Text — genau wie im alten Renderer.
    if (!url) return [text(token, marks)];
    if (bang) return [{ type: "image", attrs: { src: url, alt: label } }];
    return parseInline(label, [
      ...marks,
      { type: "link", attrs: { href: url } },
    ]);
  }

  if (token.startsWith("http")) {
    return [text(token, [...marks, { type: "link", attrs: { href: token } }])];
  }

  return parseInline(token.slice(1, -1), withMark(marks, "italic"));
}

/** Ein Absatz mit Inhalt — leere `content`-Arrays mag ProseMirror nicht. */
function paragraph(nodes: PMNode[]): PMNode {
  return nodes.length
    ? { type: "paragraph", content: nodes }
    : { type: "paragraph" };
}

export function fromMarkdown(source: string): PMDoc {
  if (!source?.trim()) return emptyDoc();

  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const content: PMNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const start = ++i;
      while (i < lines.length && !FENCE.test(lines[i])) i++;
      const code = lines.slice(start, i).join("\n");
      content.push({
        type: "codeBlock",
        attrs: { language: fence[1] || null },
        ...(code ? { content: [{ type: "text", text: code }] } : {}),
      });
      i++; // schließender Zaun
      continue;
    }

    if (RULE.test(line)) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: parseInline(heading[2]),
      });
      i++;
      continue;
    }

    // Checklisten vor den Aufzählungen: `- [ ] x` erfüllt auch BULLET.
    if (TASK.test(line)) {
      const items: PMNode[] = [];
      while (i < lines.length) {
        const task = TASK.exec(lines[i]);
        if (!task) break;
        items.push({
          type: "taskItem",
          attrs: { checked: task[1].toLowerCase() === "x" },
          content: [paragraph(parseInline(task[2]))],
        });
        i++;
      }
      content.push({ type: "taskList", content: items });
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = ORDERED.test(line);
      const matcher = ordered ? ORDERED : BULLET;
      const items: PMNode[] = [];
      while (i < lines.length) {
        // Eine Checkliste beendet die einfache Aufzählung.
        if (!ordered && TASK.test(lines[i])) break;
        const item = matcher.exec(lines[i]);
        if (!item) break;
        items.push({
          type: "listItem",
          content: [paragraph(parseInline(item[1]))],
        });
        i++;
      }
      content.push({
        type: ordered ? "orderedList" : "bulletList",
        ...(ordered ? { attrs: { start: 1 } } : {}),
        content: items,
      });
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length) {
        const quote = QUOTE.exec(lines[i]);
        if (!quote) break;
        quoted.push(quote[1]);
        i++;
      }
      content.push({
        type: "blockquote",
        content: [paragraph(parseInline(quoted.join("\n")))],
      });
      continue;
    }

    const block: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      block.push(lines[i]);
      i++;
    }
    content.push(paragraph(parseInline(block.join("\n"))));
  }

  return content.length ? { type: "doc", content } : emptyDoc();
}
