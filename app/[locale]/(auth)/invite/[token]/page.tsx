import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";
import { AcceptInviteForm } from "@/features/auth/components/AcceptInviteForm/AcceptInviteForm";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { openInvitation } from "@/lib/invitations";
import styles from "./page.module.scss";

export const dynamic = "force-dynamic";

/**
 * Eine Einladung annehmen.
 *
 * Der Token im Pfad ist die Berechtigung — die Seite liegt deshalb in der
 * Route-Group `(auth)` und ist ohne Session erreichbar (`proxy.ts`).
 *
 * Unbekannt, abgelaufen, schon benutzt: alle drei Fälle sehen gleich aus. Ein
 * Unterschied in der Meldung würde verraten, welche Tokens es gibt.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [t, invitation] = await Promise.all([
    getTranslations(),
    openInvitation(db, token, new Date()),
  ]);

  if (!invitation || invitation.hasPassword) {
    // Ein Konto mit Passwort braucht keine Einladung mehr, sondern eine
    // Anmeldung — für die Oberfläche derselbe Hinweis.
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <span className={styles.icon}>
            <Icon icon="lucide:mail-x" width={26} />
          </span>
          <h1 className={styles.title}>{t("invite.invalidTitle")}</h1>
          <p className={styles.text}>{t("invite.invalidText")}</p>
          <Link className={styles.link} href="/login">
            {t("actions.signIn")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AcceptInviteForm
      token={invitation.token}
      workspaceName={invitation.workspaceName}
      email={invitation.email}
      firstName={invitation.firstName}
      lastName={invitation.lastName}
    />
  );
}
