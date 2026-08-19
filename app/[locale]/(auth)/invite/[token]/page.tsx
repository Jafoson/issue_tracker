import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";
import { acceptInvitation } from "@/features/auth/actions";
import { AcceptInviteForm } from "@/features/auth/components/AcceptInviteForm/AcceptInviteForm";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { db } from "@/lib/db";
import { openInvitation } from "@/lib/invitations";
import { getSession } from "@/lib/session";
import styles from "./page.module.scss";

export const dynamic = "force-dynamic";

function InvalidInviteCard({
  title,
  text,
  signInLabel,
}: {
  title: string;
  text: string;
  signInLabel: string;
}) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.icon}>
          <Icon icon="lucide:mail-x" width={26} />
        </span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
        <Link className={styles.link} href="/login">
          {signInLabel}
        </Link>
      </div>
    </div>
  );
}

/**
 * Eine Einladung annehmen.
 *
 * Der Token im Pfad ist die Berechtigung — die Seite liegt deshalb in der
 * Route-Group `(auth)` und ist ohne Session erreichbar (`proxy.ts`).
 *
 * Unbekannt, abgelaufen, schon benutzt: alle drei Fälle sehen gleich aus. Ein
 * Unterschied in der Meldung würde verraten, welche Tokens es gibt.
 *
 * Der eigentliche Beitritt läuft in zwei Schritten über dieselbe Seite: erst
 * ohne Session zeigt sie `AcceptInviteForm` (Passkey für das eingeladene
 * Konto registrieren), das leitet nach der Ceremony hierher zurück — jetzt
 * mit einer Session, die zum eingeladenen Konto passt. Dieser zweite Aufruf
 * ruft `acceptInvitation()` auf (Pending-Flip, Projekt-Enrollment) und leitet
 * in den Workspace weiter.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const [t, invitation, session] = await Promise.all([
    getTranslations(),
    openInvitation(db, token, new Date()),
    getSession(),
  ]);

  if (!invitation || invitation.hasPasskey) {
    // Ein Konto mit Passkey braucht keine Einladung mehr, sondern eine
    // Anmeldung — für die Oberfläche derselbe Hinweis.
    return (
      <InvalidInviteCard
        title={t("invite.invalidTitle")}
        text={t("invite.invalidText")}
        signInLabel={t("actions.signIn")}
      />
    );
  }

  if (session?.userId === invitation.userId) {
    const result = await acceptInvitation(invitation.token);
    if ("redirectTo" in result) {
      redirect({ href: result.redirectTo, locale: locale as Locale });
    }
    // Ein Fehler hier (z. B. Token inzwischen abgelaufen) — dieselbe generische
    // Meldung wie ein ungültiger Token, statt den Grund preiszugeben.
    return (
      <InvalidInviteCard
        title={t("invite.invalidTitle")}
        text={t("invite.invalidText")}
        signInLabel={t("actions.signIn")}
      />
    );
  }

  return (
    <AcceptInviteForm
      token={invitation.token}
      workspaceName={invitation.workspaceName}
      email={invitation.email}
    />
  );
}
