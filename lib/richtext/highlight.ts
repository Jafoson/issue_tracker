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
 * Die Syntax-Hervorhebung — einmal für beide Renderer.
 *
 * Dieselbe Instanz versorgt die Anzeige (`RichText`, serverseitig) und den
 * Editor (über `@tiptap/extension-code-block-lowlight`). Zwei verschiedene
 * Hervorheber hießen: beim Schreiben andere Farben als beim Lesen.
 *
 * Registriert werden nur die Sprachen aus `CODE_LANGUAGES` — `highlight.js`
 * bringt knapp zweihundert mit, und die will niemand im Browser haben. Wer die
 * Liste dort erweitert, muss die Grammatik hier nachtragen; `LANGUAGE_GRAMMARS`
 * unten hält beide Seiten zusammen.
 */

/**
 * Grammatik je Eintrag aus `CODE_LANGUAGES`.
 *
 * Ein paar teilen sich eine: TSX und JSX laufen über TypeScript bzw.
 * JavaScript, HTML über die XML-Grammatik, TOML über die von INI. Prisma hat
 * keine eigene — dort steht die von TypeScript, deren Schlüsselwörter und
 * Zeichenketten nah genug liegen, um lesbar zu sein.
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

/** Ein Stück Code mit seiner Rolle — `className` fehlt bei schlichtem Text. */
export interface CodeToken {
  text: string;
  className?: string;
}

/** Eine Zeile. Leere Zeilen sind leere Listen, damit ihre Nummer stehen bleibt. */
export type CodeLine = CodeToken[];

/** Der Knotentyp, den lowlight liefert — bewusst schmal statt `@types/hast`. */
interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: string[] | string };
  children?: HastNode[];
}

/**
 * Flacht den Baum zu einer Folge von Stücken ab.
 *
 * `highlight.js` verschachtelt Bereiche (eine Zeichenkette kann eine
 * Ersetzung enthalten). Die Klassen werden dabei aufgesammelt, damit die
 * innere Rolle die äußere nicht verliert.
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
 * Zerlegt den Code in Zeilen aus hervorgehobenen Stücken.
 *
 * Zeilenweise, weil die Nummern daneben stehen: ein Baum, der über Umbrüche
 * hinweggeht, ließe sich nicht Zeile für Zeile ausgeben. Ein Stück, das einen
 * Umbruch enthält, wird deshalb aufgeteilt — seine Rolle behalten beide
 * Hälften.
 *
 * Ohne (oder mit unbekannter) Sprache bleibt der Text, wie er ist. Bewusst
 * kein `highlightAuto`: geraten sähe mal so und mal so aus, und der Block
 * trägt seine Sprache ohnehin.
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
 * Rät die Sprache eines Codeblocks — oder gibt `null` zurück.
 *
 * `highlight.js` probiert dafür jede registrierte Grammatik durch und bewertet,
 * wie gut sie passt. Zwei Bremsen dagegen, dass daraus Unsinn wird:
 *
 * - **Zu wenig Text wird nicht geraten.** Drei Wörter passen auf ein Dutzend
 *   Sprachen; die Erkennung wäre dann ein Münzwurf.
 * - **Eine Schwelle für die Bewertung.** `highlight.js` liefert immer einen
 *   Sieger, auch wenn keiner überzeugt. Unter der Schwelle bleibt der Block
 *   lieber schlicht als falsch beschriftet.
 *
 * Die Schwelle ist gemessen, nicht geschätzt: echter Code kommt in Stichproben
 * auf 6 bis 16 (TypeScript 6, SQL 6, Go 6, CSS 7, Python 14, Shell 16), reine
 * Prosa dagegen auf 1 — die trifft sonst zufällig irgendeine Grammatik. Fünf
 * liegt sauber dazwischen.
 *
 * Aufgerufen wird das genau einmal je Block — das Ergebnis landet als Attribut
 * im Dokument. Bei jedem Tastendruck neu zu raten hieße, dass die Farben beim
 * Schreiben springen.
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
