/**
 * Splits a list of email addresses out of free text — commas, semicolons,
 * line breaks, and other whitespace all count as separators, so a pasted
 * address block from a mail client works just as well as a list with one
 * address per line. Normalized (lowercased, trimmed) and deduplicated, so
 * the same address doesn't appear twice in the list.
 */
export function parseEmailList(text: string): string[] {
  const parts = text
    .split(/[\s,;]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(parts)];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}
