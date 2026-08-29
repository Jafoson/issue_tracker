"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Link } from "@/i18n/navigation";
import styles from "./passkeyNudge.module.scss";

/**
 * Reminds about a missing passkey — dismissible per session, not
 * permanently: the state lives only in `useState`, no preference in the
 * database. A full reload (or the next sign-in) shows it again as long as no
 * passkey is registered — exactly the active but non-forcing nudge this app
 * wants.
 */
export function PasskeyNudge({ securityHref }: { securityHref: string }) {
  const t = useTranslations();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <output className={styles.banner}>
      <Icon icon="lucide:fingerprint" width={18} className={styles.icon} />
      <p className={styles.text}>{t("account.passkeyNudge")}</p>
      <div className={styles.actions}>
        <Link href={securityHref} className={styles.link}>
          {t("account.addPasskey")}
        </Link>
        <Button
          variant="text"
          size="sm"
          aria-label={t("actions.dismiss")}
          icon={<Icon icon="lucide:x" width={14} />}
          onClick={() => setDismissed(true)}
        />
      </div>
    </output>
  );
}
