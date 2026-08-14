/** Der Inhalt einer Mail, ohne den Empfänger — den kennt nur der Aufrufer. */
export interface MailContent {
  subject: string;
  html: string;
  text: string;
}
