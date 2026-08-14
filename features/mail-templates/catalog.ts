// ─── Katalog der Mail-Vorlagen ──────────────────────────────────────────────
//
// Reine Datendefinition — kein DB-Zugriff, kein `server-only`. Sagt, welche
// Schlüssel es gibt, wie sie in der Oberfläche heißen und welche
// `{{platzhalter}}` je Vorlage gültig sind. `lib/mail/templates/*.ts` baut
// aus denselben Feldnamen seine `placeholders`-Objekte — ein hier gelisteter
// Platzhalter, der dort nicht ankommt, bliebe im Admin-Text wörtlich stehen
// (siehe `applyPlaceholders`).

export const MAIL_TEMPLATE_KEYS = [
  "invitation",
  "welcome",
  "emailVerification",
  "passwordReset",
  "notification.assigned",
  "notification.mentioned",
  "notification.comment",
  "notification.status",
  "notification.invite",
  "notification.role",
  "weeklyDigest",
  "issueUpdate",
] as const;

export type MailTemplateKey = (typeof MAIL_TEMPLATE_KEYS)[number];

export interface PlaceholderDef {
  key: string;
  description: string;
}

export interface MailTemplateMeta {
  key: MailTemplateKey;
  label: string;
  group: string;
  /** Ob es dafür heute einen Versandpunkt gibt — steht so auch im
   *  Admin-Editor, damit niemand einen bearbeiteten Text erwartet, der
   *  gerade nirgendwo verschickt wird. */
  wired: boolean;
  placeholders: PlaceholderDef[];
}

const ACTOR: PlaceholderDef = {
  key: "actorLabel",
  description: "Wer gehandelt hat",
};
const WORKSPACE: PlaceholderDef = {
  key: "workspaceName",
  description: "Name des Workspace",
};
const PROJECT: PlaceholderDef = {
  key: "projectName",
  description: "Projektname — leer, wenn workspaceweit",
};
const ISSUE_ID: PlaceholderDef = {
  key: "issueIdentifier",
  description: "Issue-Kürzel, z. B. ACME-42",
};
const ISSUE_TITLE: PlaceholderDef = {
  key: "issueTitle",
  description: "Titel des Issues",
};

export const MAIL_TEMPLATE_CATALOG: Record<MailTemplateKey, MailTemplateMeta> =
  {
    invitation: {
      key: "invitation",
      label: "Einladung",
      group: "Konto & Zugang",
      wired: true,
      placeholders: [
        { key: "inviterName", description: "Name der einladenden Person" },
        WORKSPACE,
        PROJECT,
        { key: "roleName", description: "Vergebene Rolle" },
        {
          key: "target",
          description: "„Projekt (Workspace)“ oder nur der Workspace-Name",
        },
      ],
    },
    welcome: {
      key: "welcome",
      label: "Registrierung",
      group: "Konto & Zugang",
      wired: false,
      placeholders: [{ key: "firstName", description: "Vorname" }],
    },
    emailVerification: {
      key: "emailVerification",
      label: "E-Mail bestätigen",
      group: "Konto & Zugang",
      wired: false,
      placeholders: [{ key: "firstName", description: "Vorname" }],
    },
    passwordReset: {
      key: "passwordReset",
      label: "Passwort zurücksetzen",
      group: "Konto & Zugang",
      wired: false,
      placeholders: [
        { key: "email", description: "E-Mail-Adresse des Kontos" },
      ],
    },
    "notification.assigned": {
      key: "notification.assigned",
      label: "Issue zugewiesen",
      group: "Benachrichtigungen",
      wired: true,
      placeholders: [ACTOR, ISSUE_ID, ISSUE_TITLE],
    },
    "notification.mentioned": {
      key: "notification.mentioned",
      label: "Erwähnung",
      group: "Benachrichtigungen",
      wired: true,
      placeholders: [
        ACTOR,
        ISSUE_ID,
        ISSUE_TITLE,
        { key: "text", description: "Vorschau der Erwähnung" },
      ],
    },
    "notification.comment": {
      key: "notification.comment",
      label: "Neuer Kommentar",
      group: "Benachrichtigungen",
      wired: true,
      placeholders: [
        ACTOR,
        ISSUE_ID,
        ISSUE_TITLE,
        { key: "text", description: "Kommentar-Vorschau" },
      ],
    },
    "notification.status": {
      key: "notification.status",
      label: "Statuswechsel",
      group: "Benachrichtigungen",
      wired: true,
      placeholders: [
        ACTOR,
        ISSUE_ID,
        ISSUE_TITLE,
        { key: "text", description: "Neuer Status (Rohschlüssel)" },
      ],
    },
    "notification.invite": {
      key: "notification.invite",
      label: "Mitgliedschaft (bestehendes Konto)",
      group: "Benachrichtigungen",
      wired: true,
      placeholders: [
        ACTOR,
        WORKSPACE,
        PROJECT,
        { key: "text", description: "Vergebene Rolle" },
      ],
    },
    "notification.role": {
      key: "notification.role",
      label: "Rollenänderung",
      group: "Benachrichtigungen",
      wired: true,
      placeholders: [
        ACTOR,
        WORKSPACE,
        PROJECT,
        { key: "text", description: "Neue Rolle" },
      ],
    },
    weeklyDigest: {
      key: "weeklyDigest",
      label: "Wöchentliche Zusammenfassung",
      group: "Zusammenfassungen",
      wired: false,
      placeholders: [
        { key: "firstName", description: "Vorname" },
        WORKSPACE,
        { key: "periodLabel", description: "Zeitraum, z. B. „13.–19. Januar“" },
        { key: "completedCount", description: "Anzahl erledigt" },
        { key: "assignedOpenCount", description: "Anzahl offen zugewiesen" },
        { key: "createdCount", description: "Anzahl neu angelegt" },
      ],
    },
    issueUpdate: {
      key: "issueUpdate",
      label: "Issue-Sammeländerung",
      group: "Benachrichtigungen",
      wired: false,
      placeholders: [ACTOR, ISSUE_ID, ISSUE_TITLE],
    },
  };

export function mailTemplateMeta(key: MailTemplateKey): MailTemplateMeta {
  return MAIL_TEMPLATE_CATALOG[key];
}
