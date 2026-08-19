// Die Ansichten der eigenen Einstellungen. Jede ist das, was genau eine Seite
// rendert.
//
// Rechte kommen hier nicht vor: jeder sieht ausschließlich sein eigenes Konto,
// also gibt es nichts zu entscheiden außer der Frage, wer eingeloggt ist. Was
// die Seiten stattdessen brauchen, ist der Zustand des Kontos — welche
// Passkeys und Anmeldewege daran hängen, ob die Adresse bestätigt wurde.

/** Das gewählte Design — landet als `data-theme` am Dokument. */
export type Theme = "dark" | "light" | "system";

/** Die Anlässe, zu denen die App etwas von sich hören lässt. */
export const NOTIFICATION_EVENTS = [
  "assigned",
  "mentioned",
  "comment",
  "status",
  "invite",
  "role",
  "issueShared",
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
  /** Ob der Hinweis im Plattform-Bereich weggeklickt wurde. */
  adminNoticeHidden: boolean;
}

/** Allgemein: wer man ist und wie man erscheint. */
export interface AccountProfileView {
  id: string;
  firstName: string;
  lastName: string;
  handle: string;
  email: string;
  color: string;
  /** Die Adresse ist bestätigt. Ohne Mailversand bleibt das offen — die
   *  Seite sagt das, statt es zu verschweigen. */
  emailVerified: boolean;
}

/** Ein Anmeldeweg über einen fremden Anbieter. */
export interface ConnectedAccount {
  provider: string;
  /** Am Konto hinterlegt — trennbar, solange ein anderer Weg bleibt. */
  connected: boolean;
  /** Der Server hat für diesen Anbieter Zugangsdaten. Sonst nur zu sehen. */
  available: boolean;
  /** Nur für OIDC gesetzt — sein Name kommt aus `AUTH_OIDC_NAME`, nicht aus
   *  einer festen Marken-Liste wie bei GitHub/Google. */
  label?: string;
}

export interface AccountConnectionsView {
  accounts: ConnectedAccount[];
  /** Am Konto hängt ein Passkey — dann ist kein fremder Anbieter nötig. */
  hasPasskey: boolean;
}

/** Ein hinterlegter Passkey. */
export interface PasskeyInfo {
  credentialID: string;
  deviceType: string;
  createdAt: Date;
}

/** Sicherheit: womit man hereinkommt. */
export interface AccountSecurityView {
  email: string;
  emailVerified: boolean;
  /** Anbieter, über die man sich anmelden kann — für den Verweis dorthin. */
  connectedProviders: string[];
  passkeys: PasskeyInfo[];
}
