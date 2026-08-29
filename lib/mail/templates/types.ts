/** The content of an email, without the recipient — only the caller knows that. */
export interface MailContent {
  subject: string;
  html: string;
  text: string;
}
