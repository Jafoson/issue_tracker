"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { joinViaInviteLink } from "@/features/workspaces/actions";
import { useRouter } from "@/i18n/navigation";
import styles from "./joinConfirm.module.scss";

interface Props {
  token: string;
  target: string;
  roleName: string;
  currentUserName: string;
}

/**
 * Last step in redeeming an invite link for a person who's already signed
 * in: "Join as X?" instead of a silent auto-join — anyone who clicks the
 * link with someone else's session active (shared computer, wrong account)
 * should see this before anything happens.
 */
export function JoinConfirm({
  token,
  target,
  roleName,
  currentUserName,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const confirm = () => {
    setError("");
    startTransition(async () => {
      const result = await joinViaInviteLink(token);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/${result.workspaceId}`);
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.icon}>
          <Icon icon="lucide:link" width={26} />
        </span>
        <h1 className={styles.title}>{t("join.title", { target })}</h1>
        <p className={styles.text}>
          {t("join.confirmText", { user: currentUserName, role: roleName })}
        </p>

        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            full
            disabled={isPending}
            onClick={confirm}
          >
            {t("join.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
