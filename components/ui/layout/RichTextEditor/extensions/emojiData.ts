/**
 * Die Emoji, die der `:`-Trigger anbietet.
 *
 * Bewusst eine kurze, handverlesene Liste statt eines Pakets mit mehreren
 * tausend Einträgen: in einem Issue-Tracker wiederholen sich dieselben zwanzig
 * Zeichen, und die vollständige Unicode-Tabelle wöge mehr als der Editor selbst.
 *
 * Die Schlüsselwörter sind englisch, weil die Kurznamen es auch sind — wer
 * `:daumen:` tippt, findet nichts, wer `:thumb:` tippt, schon. Das entspricht
 * dem Verhalten von Jira, Slack und GitHub.
 */

export interface EmojiEntry {
  name: string;
  emoji: string;
  /** Zusätzliche Suchbegriffe neben dem Namen. */
  keywords?: string[];
}

export const EMOJI: EmojiEntry[] = [
  // Zustimmung und Reaktion
  { name: "thumbsup", emoji: "👍", keywords: ["+1", "yes", "ok"] },
  { name: "thumbsdown", emoji: "👎", keywords: ["-1", "no"] },
  { name: "tada", emoji: "🎉", keywords: ["party", "ship", "release"] },
  { name: "rocket", emoji: "🚀", keywords: ["ship", "deploy", "launch"] },
  { name: "fire", emoji: "🔥", keywords: ["hot", "urgent"] },
  { name: "eyes", emoji: "👀", keywords: ["look", "review", "watching"] },
  { name: "clap", emoji: "👏", keywords: ["applause", "nice"] },
  { name: "pray", emoji: "🙏", keywords: ["thanks", "please"] },
  { name: "muscle", emoji: "💪", keywords: ["strong"] },
  { name: "wave", emoji: "👋", keywords: ["hello", "hi", "bye"] },
  { name: "point_right", emoji: "👉", keywords: ["this", "see"] },

  // Zustand eines Issues
  { name: "bug", emoji: "🐛", keywords: ["defect", "error"] },
  { name: "warning", emoji: "⚠️", keywords: ["caution", "careful"] },
  { name: "boom", emoji: "💥", keywords: ["crash", "breaking"] },
  { name: "construction", emoji: "🚧", keywords: ["wip", "progress"] },
  { name: "lock", emoji: "🔒", keywords: ["security", "private"] },
  { name: "key", emoji: "🔑", keywords: ["auth", "access"] },
  { name: "wrench", emoji: "🔧", keywords: ["fix", "tool", "config"] },
  { name: "hammer", emoji: "🔨", keywords: ["build", "fix"] },
  { name: "sparkles", emoji: "✨", keywords: ["feature", "new", "clean"] },
  { name: "recycle", emoji: "♻️", keywords: ["refactor"] },
  { name: "zap", emoji: "⚡", keywords: ["fast", "performance"] },
  { name: "snail", emoji: "🐌", keywords: ["slow", "performance"] },
  { name: "test_tube", emoji: "🧪", keywords: ["test", "experiment"] },
  { name: "package", emoji: "📦", keywords: ["release", "dependency"] },
  { name: "memo", emoji: "📝", keywords: ["docs", "note", "write"] },
  { name: "books", emoji: "📚", keywords: ["docs", "documentation"] },
  { name: "chart", emoji: "📈", keywords: ["metrics", "growth", "stats"] },
  { name: "calendar", emoji: "📅", keywords: ["date", "schedule", "due"] },
  { name: "hourglass", emoji: "⏳", keywords: ["waiting", "pending", "slow"] },
  { name: "alarm", emoji: "⏰", keywords: ["deadline", "reminder"] },
  { name: "pushpin", emoji: "📌", keywords: ["pin", "important"] },
  { name: "link", emoji: "🔗", keywords: ["url", "reference"] },
  { name: "mag", emoji: "🔍", keywords: ["search", "investigate", "find"] },
  { name: "bulb", emoji: "💡", keywords: ["idea", "suggestion"] },
  { name: "speech_balloon", emoji: "💬", keywords: ["comment", "discuss"] },
  { name: "question", emoji: "❓", keywords: ["help", "unclear"] },
  { name: "exclamation", emoji: "❗", keywords: ["important", "urgent"] },

  // Fortschritt
  { name: "white_check_mark", emoji: "✅", keywords: ["done", "check", "ok"] },
  { name: "x", emoji: "❌", keywords: ["no", "fail", "reject"] },
  { name: "heavy_check_mark", emoji: "✔️", keywords: ["done", "check"] },
  { name: "green_circle", emoji: "🟢", keywords: ["ok", "healthy", "go"] },
  { name: "yellow_circle", emoji: "🟡", keywords: ["warning", "partial"] },
  { name: "red_circle", emoji: "🔴", keywords: ["blocked", "down", "stop"] },
  { name: "no_entry", emoji: "⛔", keywords: ["blocked", "stop"] },

  // Gesichter
  { name: "smile", emoji: "😄", keywords: ["happy", "joy"] },
  { name: "grin", emoji: "😁", keywords: ["happy"] },
  { name: "wink", emoji: "😉", keywords: ["joke"] },
  { name: "thinking", emoji: "🤔", keywords: ["hmm", "consider", "unsure"] },
  { name: "sweat_smile", emoji: "😅", keywords: ["phew", "close"] },
  { name: "cry", emoji: "😢", keywords: ["sad"] },
  { name: "scream", emoji: "😱", keywords: ["panic", "shock"] },
  { name: "sunglasses", emoji: "😎", keywords: ["cool", "nice"] },
  { name: "facepalm", emoji: "🤦", keywords: ["oops", "obvious"] },
  { name: "shrug", emoji: "🤷", keywords: ["dunno", "whatever"] },
  { name: "heart", emoji: "❤️", keywords: ["love", "like"] },
  { name: "star", emoji: "⭐", keywords: ["favorite", "important"] },
  { name: "coffee", emoji: "☕", keywords: ["break", "monday"] },
  { name: "brain", emoji: "🧠", keywords: ["smart", "think"] },
  { name: "robot", emoji: "🤖", keywords: ["bot", "automation", "ci"] },
];

/** Treffer zur Eingabe hinter dem Doppelpunkt, Namenstreffer zuerst. */
export function searchEmoji(query: string, limit = 12): EmojiEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return EMOJI.slice(0, limit);

  const byName: EmojiEntry[] = [];
  const byKeyword: EmojiEntry[] = [];

  for (const entry of EMOJI) {
    if (entry.name.includes(q)) byName.push(entry);
    else if (entry.keywords?.some((k) => k.includes(q))) byKeyword.push(entry);
  }

  return [...byName, ...byKeyword].slice(0, limit);
}
