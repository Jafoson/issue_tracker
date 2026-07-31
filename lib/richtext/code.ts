/**
 * Die Sprachen, die ein Codeblock kennt.
 *
 * Eine handverlesene Liste statt einer vollständigen: die Angabe steht im
 * Dokument und dient zwei Zwecken — sie beschriftet den Block und wäre der
 * Anker für eine spätere Einfärbung. Beides braucht keine dreihundert
 * Einträge, und eine kurze Liste lässt sich im Menü überblicken.
 *
 * Die Werte sind die üblichen Kurznamen, damit sie zu dem passen, was in
 * Markdown hinter den drei Backticks steht (```ts) — und damit `fromMarkdown`
 * sie unverändert übernehmen kann.
 */

export interface CodeLanguage {
  /** Steht im Dokument. */
  value: string;
  /** Steht im Menü. */
  label: string;
  /** Weitere Schreibweisen, die auf denselben Eintrag zeigen. */
  aliases?: string[];
}

export const CODE_LANGUAGES: CodeLanguage[] = [
  { value: "ts", label: "TypeScript", aliases: ["typescript"] },
  { value: "tsx", label: "TSX" },
  { value: "js", label: "JavaScript", aliases: ["javascript", "node"] },
  { value: "jsx", label: "JSX" },
  { value: "json", label: "JSON" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS", aliases: ["sass"] },
  { value: "sql", label: "SQL" },
  { value: "prisma", label: "Prisma" },
  { value: "bash", label: "Shell", aliases: ["sh", "shell", "zsh", "console"] },
  { value: "python", label: "Python", aliases: ["py"] },
  { value: "java", label: "Java" },
  { value: "kotlin", label: "Kotlin", aliases: ["kt"] },
  { value: "go", label: "Go", aliases: ["golang"] },
  { value: "rust", label: "Rust", aliases: ["rs"] },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby", aliases: ["rb"] },
  { value: "csharp", label: "C#", aliases: ["cs"] },
  { value: "cpp", label: "C++", aliases: ["c++", "cc"] },
  { value: "c", label: "C" },
  { value: "yaml", label: "YAML", aliases: ["yml"] },
  { value: "toml", label: "TOML" },
  { value: "xml", label: "XML" },
  { value: "markdown", label: "Markdown", aliases: ["md"] },
  { value: "diff", label: "Diff", aliases: ["patch"] },
  { value: "docker", label: "Dockerfile", aliases: ["dockerfile"] },
  { value: "graphql", label: "GraphQL", aliases: ["gql"] },
];

/** Der Eintrag zu einer gespeicherten Angabe — über Wert oder Schreibweise. */
export function findLanguage(value: unknown): CodeLanguage | null {
  if (typeof value !== "string" || !value) return null;
  const needle = value.trim().toLowerCase();
  return (
    CODE_LANGUAGES.find(
      (l) => l.value === needle || l.aliases?.includes(needle),
    ) ?? null
  );
}

/** Steht am Block, solange keine Sprache gewählt ist. Fachbegriff, unübersetzt. */
export const PLAIN_LANGUAGE = "Plain";

/**
 * Ausdrücklich keine Sprache.
 *
 * Zu unterscheiden von `null`, das „noch nicht entschieden" heißt: nur dort
 * darf die Erkennung raten. Wer im Menü „Plain" wählt, meint es so — und soll
 * es nicht beim nächsten Tastendruck wieder überschrieben bekommen.
 */
export const PLAIN_VALUE = "plain";

/**
 * Was am Block steht.
 *
 * Eine unbekannte Angabe wird nicht verworfen, sondern durchgereicht: sie kam
 * vielleicht aus einem eingefügten Markdown-Block, und die Information ist
 * mehr wert als eine saubere Liste.
 */
export function languageLabel(value: unknown): string {
  const known = findLanguage(value);
  if (known) return known.label;
  return typeof value === "string" && value.trim()
    ? value.trim()
    : PLAIN_LANGUAGE;
}

/** Zählt die Zeilen eines Codeblocks — Grundlage für die Zeilennummern. */
export function countLines(code: string): number {
  // Ein abschließender Umbruch erzeugt keine weitere Zeile: sonst stünde unter
  // dem letzten Zeichen eine leere Nummer.
  const text = code.endsWith("\n") ? code.slice(0, -1) : code;
  return text.length === 0 ? 1 : text.split("\n").length;
}
