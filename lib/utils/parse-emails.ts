/**
 * Trennt eine Liste von E-Mail-Adressen aus Freitext — Kommas, Semikolons,
 * Zeilenumbrüche und sonstige Leerräume zählen alle als Trenner, damit ein
 * eingefügter Adressblock aus einem Mailclient genauso funktioniert wie eine
 * Liste mit einer Adresse pro Zeile. Normalisiert (klein, getrimmt) und
 * dedupliziert, damit dieselbe Adresse nicht zweimal in der Liste steht.
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
