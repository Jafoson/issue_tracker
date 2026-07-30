import type { ReactNode } from "react";
import styles from "./markdown.module.scss";

/**
 * Markdown-Anzeige ohne Abhängigkeit: unterstützt die Teilmenge, die der
 * `MarkdownEditor` erzeugt — Überschriften, Listen, Zitate, Code (inline und
 * als Block), Trennlinien, fett, kursiv, durchgestrichen, Links und Bilder.
 *
 * Bewusst kein `dangerouslySetInnerHTML`: alles wird als React-Elemente gebaut,
 * damit fremder Text niemals als HTML im Dokument landet. Adressen laufen durch
 * `safeUrl`, damit `javascript:`-Links gar nicht erst entstehen.
 *
 * Keine Client-Direktive — die Komponente rendert nur und läuft deshalb auch in
 * Server Components.
 */

const FENCE = /^\s*```(\w*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

/** Reihenfolge zählt: längere Marker müssen vor ihren kürzeren Varianten stehen. */
const INLINE_PATTERN = [
  "(`[^`]+`)", // Code
  "(\\*\\*[^]+?\\*\\*)", // **fett**
  "(__[^]+?__)", // __fett__
  "(~~[^]+?~~)", // ~~durchgestrichen~~
  "(\\*[^*\\n]+?\\*)", // *kursiv*
  "(_[^_\\n]+?_)", // _kursiv_
  "(!?\\[[^\\]]*\\]\\([^)\\s]+\\))", // [Text](Adresse) und ![Alt](Adresse)
  "(https?://[^\\s<>()]+)", // nackte Adresse
].join("|");

const LINK = /^(!?)\[([^\]]*)\]\(([^)\s]+)\)$/;

/** Nur Adressen, die im Browser harmlos sind — alles andere bleibt Text. */
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

function renderToken(token: string, key: string): ReactNode {
  if (token.startsWith("`")) return <code key={key}>{token.slice(1, -1)}</code>;
  if (token.startsWith("**") || token.startsWith("__"))
    return <strong key={key}>{renderInline(token.slice(2, -2), key)}</strong>;
  if (token.startsWith("~~"))
    return <del key={key}>{renderInline(token.slice(2, -2), key)}</del>;

  const link = LINK.exec(token);
  if (link) {
    const [, bang, text, target] = link;
    const url = safeUrl(target);
    if (!url) return token;
    if (bang)
      // biome-ignore lint/performance/noImgElement: fremde Adresse, kein bekanntes Format und keine bekannten Maße — `next/image` kann hier nichts optimieren
      return <img key={key} src={url} alt={text} />;
    return (
      <a key={key} href={url} target="_blank" rel="noopener noreferrer">
        {renderInline(text, key)}
      </a>
    );
  }

  if (token.startsWith("http"))
    return (
      <a key={key} href={token} target="_blank" rel="noopener noreferrer">
        {token}
      </a>
    );

  return <em key={key}>{renderInline(token.slice(1, -1), key)}</em>;
}

/**
 * Zerlegt eine Zeile in Text und Auszeichnungen. Der Scanner wird pro Aufruf neu
 * gebaut, weil `renderToken` für verschachtelte Auszeichnungen zurückspringt und
 * sich beide sonst die Suchposition der Regex teilen würden.
 */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const scanner = new RegExp(INLINE_PATTERN, "g");
  const nodes: ReactNode[] = [];
  let last = 0;
  let match = scanner.exec(text);

  while (match) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(renderToken(match[0], `${keyPrefix}-${match.index}`));
    last = match.index + match[0].length;
    match = scanner.exec(text);
  }
  if (last < text.length) nodes.push(text.slice(last));

  return nodes;
}

/**
 * Einzelne Umbrüche innerhalb eines Absatzes bleiben stehen — wie im Editor
 * getippt. Die Zeilen bleiben dafür ein zusammenhängender Text, den `pre-wrap`
 * umbricht; einzelne `<br>`-Elemente bräuchten Schlüssel und brächten nichts.
 */
function renderLines(lines: string[], keyPrefix: string): ReactNode[] {
  return renderInline(lines.join("\n"), keyPrefix);
}

function renderBlocks(source: string): ReactNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const key = `b${i}`;

    if (!line.trim()) {
      i++;
      continue;
    }

    if (FENCE.test(line)) {
      const start = ++i;
      while (i < lines.length && !FENCE.test(lines[i])) i++;
      blocks.push(
        <pre key={key}>
          <code>{lines.slice(start, i).join("\n")}</code>
        </pre>,
      );
      i++; // schließender Zaun
      continue;
    }

    if (RULE.test(line)) {
      blocks.push(<hr key={key} />);
      i++;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      blocks.push(<Tag key={key}>{renderInline(heading[2], key)}</Tag>);
      i++;
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = ORDERED.test(line);
      const matcher = ordered ? ORDERED : BULLET;
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const item = matcher.exec(lines[i]);
        if (!item) break;
        items.push(<li key={`i${i}`}>{renderInline(item[1], `i${i}`)}</li>);
        i++;
      }
      blocks.push(
        ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>,
      );
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
      blocks.push(
        <blockquote key={key}>{renderLines(quoted, key)}</blockquote>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      paragraph.push(lines[i]);
      i++;
    }
    blocks.push(<p key={key}>{renderLines(paragraph, key)}</p>);
  }

  return blocks;
}

interface MarkdownProps {
  /** Der Markdown-Quelltext. */
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={[styles.markdown, className].filter(Boolean).join(" ")}>
      {renderBlocks(children)}
    </div>
  );
}
