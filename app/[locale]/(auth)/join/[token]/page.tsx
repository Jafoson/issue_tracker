import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";
import { JoinConfirm } from "@/features/auth/components/JoinConfirm/JoinConfirm";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { resolveInviteLink } from "@/lib/invite-links";
import { getSession } from "@/lib/session";
import styles from "./page.module.scss";

export const dynamic = "force-dynamic";

/**
 * Einen Einladungslink einlösen.
 *
 * Der Token im Pfad ist die Berechtigung — die Seite liegt deshalb in der
 * Route-Group `(auth)` und ist ohne Session erreichbar (`proxy.ts`).
 *
 * Drei Ausgänge: unbekannt/widerrufen/abgelaufen (eine Meldung für alle drei —
 * kein Orakel für gültige Tokens, wie bei `/invite/[token]`), eingeloggt
 * (Bestätigung "als X beitreten?"), oder ausgeloggt (Anmelden/Registrieren,
 * beide mit dem Token im `callbackUrl`, damit dieselbe Seite nach der
 * Anmeldung noch einmal aufgerufen wird und dann in den eingeloggten Zweig
 * fällt).
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [t, link, session] = await Promise.all([
    getTranslations(),
    resolveInviteLink(db, token, new Date()),
    getSession(),
  ]);

  if (!link) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <span className={styles.icon}>
            <Icon icon="lucide:link-2-off" width={26} />
          </span>
          <h1 className={styles.title}>{t("join.invalidTitle")}</h1>
          <p className={styles.text}>{t("join.invalidText")}</p>
          <Link className={styles.link} href="/login">
            {t("actions.signIn")}
          </Link>
        </div>
      </div>
    );
  }

  const target = link.projectName
    ? `${link.projectName} (${link.workspaceName})`
    : link.workspaceName;

  if (session) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true, lastName: true },
    });
    const currentUserName = user
      ? `${user.firstName} ${user.lastName}`.trim()
      : "";

    return (
      <JoinConfirm
        token={token}
        target={target}
        roleName={link.roleName}
        currentUserName={currentUserName}
      />
    );
  }

  const callbackUrl = `/join/${token}`;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.icon}>
          <Icon icon="lucide:link" width={26} />
        </span>
        <h1 className={styles.title}>{t("join.title", { target })}</h1>
        <p className={styles.text}>
          {t("join.chooseText", { role: link.roleName })}
        </p>

        <div className={styles.actions}>
          <Link
            className={styles.link}
            href={{
              pathname: "/login",
              query: { callbackUrl },
            }}
          >
            {t("actions.signIn")}
          </Link>
          <Link
            className={styles.link}
            href={{
              pathname: "/register",
              query: { callbackUrl },
            }}
          >
            {t("login.signUp")}
          </Link>
        </div>
      </div>
    </div>
  );
}
