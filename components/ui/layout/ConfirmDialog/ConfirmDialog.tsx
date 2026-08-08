"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { ModalFooter } from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import { useModal } from "@/lib/context";
import styles from "./confirmDialog.module.scss";

export interface ConfirmOptions {
  title: string;
  /** Was auf dem Spiel steht. Der Titel fragt, dieser Satz erklärt. */
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  /**
   * Die Bestätigung führt zu einem Verlust (verwerfen, löschen) und wird rot
   * gezeichnet. Default: false.
   */
  danger?: boolean;
}

/**
 * Rückfrage als Dialog statt als `window.confirm`.
 *
 * Gebraucht überall dort, wo die Antwort abgewartet werden muss, ohne den
 * Browser anzuhalten: `confirm()` blockiert den Haupt-Thread und lässt sich
 * weder übersetzen noch gestalten — und in einigen Browsern unterdrücken
 * Nutzer den Dialog dauerhaft, womit die Rückfrage still zu einem „Abbrechen"
 * würde.
 *
 * ```tsx
 * const confirm = useConfirm()
 * if (await confirm({ title, confirmLabel, cancelLabel })) …
 * ```
 *
 * Escape und Backdrop zählen als „Abbrechen": ein weggeklickter Dialog darf
 * nichts auslösen.
 */
export function useConfirm() {
  const { openModal } = useModal();

  return useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // Der Dialog kann auf zwei Wegen enden — geantwortet oder weggeklickt.
        // Beide laufen hier zusammen, gültig ist der erste.
        let answered = false;
        const settle = (value: boolean) => {
          if (answered) return;
          answered = true;
          resolve(value);
        };

        openModal(
          ({ close }) => (
            <ConfirmDialog
              options={options}
              onAnswer={(value) => {
                settle(value);
                close();
              }}
            />
          ),
          { label: options.title, onClose: () => settle(false) },
        );
      }),
    [openModal],
  );
}

function ConfirmDialog({
  options,
  onAnswer,
}: {
  options: ConfirmOptions;
  onAnswer: (value: boolean) => void;
}) {
  return (
    // Schmaler als ein Formular-Modal: hier stehen zwei Sätze und zwei Knöpfe.
    <Modal width={440}>
      <ModalHeader title={options.title} divider={false} />

      {options.description && (
        <ModalBody className={styles.body}>
          <p className={styles.text}>{options.description}</p>
        </ModalBody>
      )}

      <ModalFooter divider={false}>
        <Button variant="text" onClick={() => onAnswer(false)}>
          {options.cancelLabel}
        </Button>
        <Button
          variant="primary"
          className={options.danger ? styles.danger : undefined}
          onClick={() => onAnswer(true)}
        >
          {options.confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
