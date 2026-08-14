"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { ModalFooter } from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import styles from "./addLinkDialog.module.scss";

interface Props {
  close: () => void;
  /** Trägt den fertigen Link in die Liste des aufrufenden Formulars ein — der
   * Dialog selbst schreibt nichts, das Formular speichert erst beim eigenen
   * „Speichern“. */
  onAdd: (link: { label: string; url: string }) => void;
}

/**
 * „Link hinzufügen“ als eigener Dialog statt einer weiteren Zeile im
 * Formular — zwei Felder, eine Absicht, dann zu. Die Liste der Einstellungen
 * bleibt dadurch eine Liste aus fertigen Chips statt eines wachsenden Stapels
 * halb ausgefüllter Eingabezeilen.
 */
export function AddLinkDialog({ close, onAdd }: Props) {
  const t = useTranslations();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const add = () => {
    const trimmedLabel = label.trim();
    const trimmedUrl = url.trim();
    if (!trimmedLabel || !trimmedUrl) {
      setError(t("workspaceSettings.linksIncomplete"));
      return;
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setError(t("workspaceSettings.linksInvalidUrl"));
      return;
    }
    onAdd({ label: trimmedLabel, url: trimmedUrl });
    close();
  };

  return (
    <Modal width={420}>
      <ModalHeader
        title={t("workspaceSettings.addLink")}
        leading={<Icon icon="lucide:link" width={16} />}
        onClose={close}
        closeLabel={t("actions.cancel")}
      />

      <ModalBody className={styles.body}>
        <Input
          label={t("workspaceSettings.linksLabel")}
          placeholder={t("workspaceSettings.linksLabelPlaceholder")}
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setError("");
          }}
        />
        <Input
          label={t("workspaceSettings.linksUrl")}
          placeholder={t("workspaceSettings.linksUrlPlaceholder")}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
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
        <Button variant="outline" onClick={close}>
          {t("actions.cancel")}
        </Button>
        <Button variant="primary" onClick={add}>
          {t("workspaceSettings.addLink")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
