/**
 * The languages a code block knows about.
 *
 * A hand-picked list rather than a complete one: the value lives in the
 * document and serves two purposes — it labels the block and would be the
 * anchor for later syntax highlighting. Neither needs three hundred
 * entries, and a short list stays scannable in the menu.
 *
 * The values are the usual short names, so they match what follows the
 * three backticks in Markdown (```ts) — and so `fromMarkdown` can carry
 * them over unchanged.
 */

export interface CodeLanguage {
  /** Lives in the document. */
  value: string;
  /** Shown in the menu. */
  label: string;
  /** Other spellings that point to the same entry. */
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

/** The entry for a stored value — matched by value or by an alias. */
export function findLanguage(value: unknown): CodeLanguage | null {
  if (typeof value !== "string" || !value) return null;
  const needle = value.trim().toLowerCase();
  return (
    CODE_LANGUAGES.find(
      (l) => l.value === needle || l.aliases?.includes(needle),
    ) ?? null
  );
}

/** Shown on the block as long as no language is chosen. Technical term, left untranslated. */
export const PLAIN_LANGUAGE = "Plain";

/**
 * Explicitly no language.
 *
 * To be distinguished from `null`, which means "not yet decided": only
 * there is detection allowed to guess. Whoever picks "Plain" in the menu
 * means it — and shouldn't have it overwritten again on the next keystroke.
 */
export const PLAIN_VALUE = "plain";

/**
 * What's shown on the block.
 *
 * An unknown value isn't discarded, it's passed through: it might have come
 * from a pasted Markdown block, and the information is worth more than a
 * clean list.
 */
export function languageLabel(value: unknown): string {
  const known = findLanguage(value);
  if (known) return known.label;
  return typeof value === "string" && value.trim()
    ? value.trim()
    : PLAIN_LANGUAGE;
}

/** Counts the lines of a code block — the basis for line numbers. */
export function countLines(code: string): number {
  // A trailing line break doesn't create another line: otherwise there'd
  // be an empty number under the last character.
  const text = code.endsWith("\n") ? code.slice(0, -1) : code;
  return text.length === 0 ? 1 : text.split("\n").length;
}
