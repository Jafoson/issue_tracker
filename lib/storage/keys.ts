// Pur, ohne `server-only` — Schlüsselschema ist reine Stringlogik.

export type AvatarKind = "user" | "workspace" | "project";

/**
 * Zufälliger Suffix pro Upload statt eines festen Namens: "Ersetzen" heißt
 * dadurch immer "neuer Key hochladen, alten danach best-effort löschen",
 * nie ein In-Place-Überschreiben — das vermeidet Cache-Altlasten bei
 * signierten URLs, die den alten Inhalt noch eine Weile ausliefern könnten.
 */
export function avatarObjectKey(
  kind: AvatarKind,
  ownerId: string,
  ext: string,
): string {
  return `${kind}s/${ownerId}/${crypto.randomUUID()}.${ext}`;
}

export function isOwnAvatarKey(
  kind: AvatarKind,
  ownerId: string,
  key: string,
): boolean {
  return key.startsWith(`${kind}s/${ownerId}/`);
}

/**
 * Endung aus dem Originalnamen ableiten — anders als bei Avataren gibt es für
 * Anhänge keine MIME-Allowlist (jeder Dateityp ist erlaubt), also auch keine
 * MIME→Endung-Tabelle. Nur druckbare, unverfängliche Zeichen; ohne brauchbare
 * Endung ein neutraler Fallback statt eines leeren Suffix.
 */
export function sanitizeAttachmentExt(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0 || dot === fileName.length - 1) return "bin";
  const ext = fileName
    .slice(dot + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return ext.slice(0, 10) || "bin";
}

/**
 * Zufälliger Suffix pro Upload, wie bei Avataren — "Ersetzen" heißt auch hier
 * immer "neuer Key, alter wird best-effort gelöscht", nie ein In-Place-
 * Überschreiben.
 */
export function attachmentObjectKey(issueId: string, ext: string): string {
  return `attachments/${issueId}/${crypto.randomUUID()}.${ext}`;
}

export function isOwnAttachmentKey(issueId: string, key: string): boolean {
  return key.startsWith(`attachments/${issueId}/`);
}
