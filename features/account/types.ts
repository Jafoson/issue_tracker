// Die Ansichten der eigenen Einstellungen. Jede ist das, was genau eine Seite
// rendert.
//
// Rechte kommen hier nicht vor: jeder sieht ausschließlich sein eigenes Konto,
// also gibt es nichts zu entscheiden außer der Frage, wer eingeloggt ist. Was
// die Seiten stattdessen brauchen, ist der Zustand des Kontos — ob ein Passwort
// gesetzt ist, welche Anmeldewege daran hängen, ob die Adresse bestätigt wurde.

/** Design und Dichte — landet als `data-theme` / `data-density` am Dokument. */
export type Theme = "dark" | "light" | "system";
export type Density = "airy" | "compact";

/** Die Anlässe, zu denen die App etwas von sich hören lässt. */
export const NOTIFICATION_EVENTS = [
  "assigned",
  "mentioned",
  "comment",
  "status",
  "invite",
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

/** Die Wege, auf denen sie es tut. */
export const NOTIFICATION_CHANNELS = ["InApp", "Email"] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** Ein Spaltenname der Tabelle: `assignedInApp`, `commentEmail`, … */
export type NotificationKey = `${NotificationEvent}${NotificationChannel}`;

export type NotificationSettings = Record<NotificationKey, boolean>;

/** Was jemand für sich eingestellt hat — mit den Vorgaben, wenn noch nichts. */
export interface Preferences extends NotificationSettings {
  theme: Theme;
  density: Density;
}

/** Allgemein: wer man ist und wie man erscheint. */
export interface AccountProfileView {
  id: string;
  firstName: string;
  lastName: string;
  handle: string;
  email: string;
  color: string;
  /** Die Adresse ist bestätigt. Ohne Mailversand bleibt das bei Konten aus dem
   *  Passwort-Weg offen — die Seite sagt das, statt es zu verschweigen. */
  emailVerified: boolean;
}

/** Ein Anmeldeweg über einen fremden Anbieter. */
export interface ConnectedAccount {
  provider: string;
  /** Am Konto hinterlegt — trennbar, solange ein anderer Weg bleibt. */
  connected: boolean;
  /** Der Server hat für diesen Anbieter Zugangsdaten. Sonst nur zu sehen. */
  available: boolean;
}

export interface AccountConnectionsView {
  accounts: ConnectedAccount[];
  /** Am Konto hängt ein Passwort — dann ist kein fremder Anbieter nötig. */
  hasPassword: boolean;
}

/** Sicherheit: womit man hereinkommt. */
export interface AccountSecurityView {
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  /** Anbieter, über die man sich anmelden kann — für den Verweis dorthin. */
  connectedProviders: string[];
}
