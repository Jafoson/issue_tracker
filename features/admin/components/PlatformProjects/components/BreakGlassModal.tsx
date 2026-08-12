"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { ModalFooter } from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import { breakGlassJoinProject } from "@/features/admin/actions";
import type { PlatformProject } from "@/features/admin/queries";
import styles from "./breakGlassModal.module.scss";

interface Props {
  project: PlatformProject;
  close: () => void;
}

/** Dieselbe Untergrenze wie in `breakGlassJoinProject` — hier nur zum Abblenden. */
const MIN_REASON = 10;

/**
 * Der Notfall-Zugriff, als Dialog.
 *
 * Er ist absichtlich unbequem. Der Dialog sagt vor der Handlung, was sie
 * bedeutet — nicht nachher als Bestätigung: dass die Mitgliedschaft im Projekt
 * für alle sichtbar ist, dass die Begründung mit dem eigenen Namen im Protokoll
 * steht, und dass sie stehen bleibt. Wer nur nachsehen wollte, hört hier auf;
 * wer wirklich muss, schreibt zwei Sätze und geht hinein.
 *
 * Die Begründung ist deshalb ein Pflichtfeld und kein Kommentarfeld: der Knopf
 * bleibt aus, bis etwas dasteht.
 */
export function BreakGlassModal({ project, close }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const ready = reason.trim().length >= MIN_REASON;

  const submit = () => {
    if (!ready || isPending) return;
    startTransition(async () => {
      const result = await breakGlassJoinProject({
        projectId: project.id,
        reason: reason.trim(),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
      close();
    });
  };

  return (
    <Modal width={520}>
      <ModalHeader
        leading={
          <Icon icon="lucide:siren" width={16} className={styles.headerIcon} />
        }
        title={t("platform.breakGlassTitle", { name: project.name })}
        onClose={close}
        closeLabel={t("actions.close")}
      />

      <ModalBody className={styles.body}>
        <p className={styles.desc}>{t("platform.breakGlassDesc")}</p>

        <ul className={styles.terms}>
          <li>
            <Icon icon="lucide:eye" width={14} />
            {t("platform.breakGlassVisible")}
          </li>
          <li>
            <Icon icon="lucide:scroll-text" width={14} />
            {t("platform.breakGlassLogged")}
          </li>
          <li>
            <Icon icon="lucide:undo-2" width={14} />
            {t("platform.breakGlassLeave")}
          </li>
        </ul>

        <Input
          label={t("platform.breakGlassReason")}
          hint={t("platform.breakGlassReasonHint")}
          value={reason}
          disabled={isPending}
          autoFocus
          maxLength={300}
          onChange={(e) => {
            setReason(e.target.value);
            setError("");
          }}
        />

        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="text" onClick={close} disabled={isPending}>
          {t("actions.cancel")}
        </Button>
        <Button
          variant="primary"
          onClick={submit}
          disabled={!ready || isPending}
        >
          {t("platform.breakGlassConfirm")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
