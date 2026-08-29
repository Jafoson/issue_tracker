import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import graphql from "highlight.js/lib/languages/graphql";
import toml from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import scss from "highlight.js/lib/languages/scss";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { createLowlight } from "lowlight";
import { findLanguage } from "./code";

/**
 * Syntax highlighting — one setup for both renderers.
 *
 * The same instance serves the display (`RichText`, server-side) and the
 * editor (via `@tiptap/extension-code-block-lowlight`). Two different
 * highlighters would mean different colors while writing than while
 * reading.
 *
 * Only the languages from `CODE_LANGUAGES` are registered — `highlight.js`
 * ships close to two hundred, and nobody wants those in the browser.
 * Extending the list there means adding the grammar here too;
 * `LANGUAGE_GRAMMARS` below keeps both sides in sync.
 */

/**
 * Grammar for each entry in `CODE_LANGUAGES`.
 *
 * A few share one: TSX and JSX run through TypeScript and JavaScript
 * respectively, HTML through the XML grammar, TOML through the one for INI.
 * Prisma has none of its own — it uses TypeScript's, whose keywords and
 * string literals are close enough to stay readable.
 */
const LANGUAGE_GRAMMARS = {
  ts: typescript,
  tsx: typescript,
  js: javascript,
  jsx: javascript,
  json,
  html: xml,
  xml,
  css,
  scss,
  sql,
  prisma: typescript,
  bash,
  python,
  java,
  kotlin,
  go,
  rust,
  php,
  ruby,
  csharp,
  cpp,
  c,
  yaml,
  toml,
  markdown,
  diff,
  docker: dockerfile,
  graphql,
} as const;

export const lowlight = createLowlight();

for (const [name, grammar] of Object.entries(LANGUAGE_GRAMMARS)) {
  lowlight.register(name, grammar);
}

/** A piece of code with its role — `className` is absent for plain text. */
export interface CodeToken {
  text: string;
  className?: string;
}

/** One line. Empty lines are empty arrays, so their line number still shows. */
export type CodeLine = CodeToken[];

/** The node type that lowlight returns — deliberately narrow instead of `@types/hast`. */
interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: string[] | string };
  children?: HastNode[];
}

/**
 * Flattens the tree into a sequence of pieces.
 *
 * `highlight.js` nests regions (a string can contain a substitution). The
 * classes are collected along the way, so the inner role doesn't lose the
 * outer one.
 */
function flatten(nodes: HastNode[], inherited: string[], out: CodeToken[]) {
  for (const node of nodes) {
    if (node.type === "text") {
      if (node.value) {
        out.push({
          text: node.value,
          ...(inherited.length ? { className: inherited.join(" ") } : {}),
        });
      }
      continue;
    }

    const own = node.properties?.className;
    const classes = Array.isArray(own) ? own : own ? [own] : [];
    flatten(node.children ?? [], [...inherited, ...classes], out);
  }
}

/**
 * Splits the code into lines of highlighted pieces.
 *
 * Line by line, because the line numbers sit next to it: a tree that spans
 * across line breaks couldn't be rendered line by line. A piece that
 * contains a line break is therefore split — both halves keep its role.
 *
 * Without a language (or with an unknown one), the text stays as it is.
 * Deliberately no `highlightAuto`: a guess would look different every time,
 * and the block already carries its language anyway.
 */
export function highlightLines(code: string, language: unknown): CodeLine[] {
  const text = code.endsWith("\n") ? code.slice(0, -1) : code;
  const known = findLanguage(language);

  const tokens: CodeToken[] = [];
  if (known && lowlight.registered(known.value)) {
    const tree = lowlight.highlight(known.value, text) as unknown as HastNode;
    flatten(tree.children ?? [], [], tokens);
  } else {
    tokens.push({ text });
  }

  const lines: CodeLine[] = [[]];
  for (const token of tokens) {
    const parts = token.text.split("\n");
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ ...token, text: part });
    });
  }
  return lines;
}

/**
 * Guesses the language of a code block — or returns `null`.
 *
 * `highlight.js` does this by trying every registered grammar and scoring
 * how well it fits. Two safeguards against that turning into nonsense:
 *
 * - **Too little text isn't guessed at all.** Three words fit a dozen
 *   languages; detection would then be a coin flip.
 * - **A threshold on the score.** `highlight.js` always returns a winner,
 *   even when none of them are convincing. Below the threshold, the block
 *   stays plain rather than mislabeled.
 *
 * The threshold is measured, not estimated: real code scores 6 to 16 in
 * samples (TypeScript 6, SQL 6, Go 6, CSS 7, Python 14, Shell 16), plain
 * prose scores 1 — which would otherwise randomly hit some grammar or
 * other. Five sits cleanly in between.
 *
 * This is called exactly once per block — the result is stored as an
 * attribute in the document. Re-guessing on every keystroke would mean the
 * colors jump around while typing.
 */
export function detectLanguage(code: string): string | null {
  const text = code.trim();
  if (text.length < 40 || text.split("\n").length < 2) return null;

  const result = lowlight.highlightAuto(text) as unknown as {
    data?: { language?: string; relevance?: number };
  };

  const { language, relevance } = result.data ?? {};
  if (!language || (relevance ?? 0) < 5) return null;

  return findLanguage(language)?.value ?? null;
}
