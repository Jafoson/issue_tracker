// Pur, ohne `server-only` — Schlüsselschema ist reine Stringlogik.

export type AvatarKind = "user" | "workspace";

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
