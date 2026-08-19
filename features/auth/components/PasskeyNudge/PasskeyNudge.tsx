"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Link } from "@/i18n/navigation";
import styles from "./passkeyNudge.module.scss";

/**
 * Erinnert an einen fehlenden Passkey — pro Sitzung wegklickbar, nicht
 * dauerhaft: der Zustand lebt nur in `useState`, keine Präferenz in der
 * Datenbank. Ein voller Neuladen (oder die nächste Anmeldung) zeigt ihn
 * wieder, solange kein Passkey hinterlegt ist — genau das aktive, aber nicht
 * erzwingende Einfordern, das für diese App gewünscht ist.
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
