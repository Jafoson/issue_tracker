"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { ColorPicker } from "@/components/ui/atoms/ColorPicker/ColorPicker";
import { Input } from "@/components/ui/atoms/Input/Input";
import { Label } from "@/components/ui/atoms/Label/Label";
import {
  ModalFooter,
  ModalShortcut,
} from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import { createLabel, updateLabel } from "@/features/issues/actions";
import { PALETTE } from "@/lib/utils";
import styles from "./labelModal.module.scss";

/** Was der Dialog von einem bestehenden Label braucht — Projekt wie Workspace. */
interface EditableLabel {
  id: string;
  name: string;
  color: string;
}

interface Props {
  workspaceId: string;
  /**
   * Das Projekt, dem das neue Label gehören soll. Ohne es entsteht ein Label
   * des Workspace, das in jedem seiner Projekte gilt — derselbe Dialog, eine
   * Ebene höher. Beim Bearbeiten ist die Zugehörigkeit ohnehin entschieden.
   */
  projectId?: string | null;
  /** Gesetzt = bearbeiten, offen = anlegen. */
  label?: EditableLabel;
  onDone: () => void;
  close: () => void;
}

/**
 * Anlegen und Bearbeiten in einem Dialog — es sind dieselben zwei Felder.
 *
 * Der Slug fehlt bewusst: beim Anlegen vergibt ihn der Server aus dem Namen,
 * beim Bearbeiten bleibt er stehen, weil er in Filter-URLs steckt. Ein Feld,
 * das man sieht, aber nicht ändern kann, wirft mehr Fragen auf, als es
 * beantwortet — die Liste zeigt den Slug daneben.
 */
export function LabelModal({
  workspaceId,
  projectId,
  label,
  onDone,
  close,
}: Props) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(label?.name ?? "");
  const [color, setColor] = useState(label?.color ?? PALETTE[0]);
  const [error, setError] = useState("");

  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed || isPending) return;

    startTransition(async () => {
      try {
        // `createLabel` wirft (es bedient auch den Label-Picker im Issue),
        // `updateLabel` meldet zurück. Beide Wege enden hier in derselben
        // Zeile — der Dialog soll den Unterschied nicht kennen müssen.
        if (label) {
          const result = await updateLabel(label.id, { name: trimmed, color });
          if ("error" in result) {
            setError(result.error);
            return;
          }
        } else {
          await createLabel({
            name: trimmed,
            color,
            workspaceId,
            projectId: projectId ?? null,
          });
        }
        onDone();
        close();
      } catch {
        setError(t("projectLabels.saveFailed"));
      }
    });
  };

  return (
    <Modal width={440}>
      <ModalHeader
        title={
          label ? t("projectLabels.editTitle") : t("projectLabels.newTitle")
        }
        onClose={close}
        closeLabel={t("actions.cancel")}
      />

      <ModalBody>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input
            label={t("fields.name")}
            value={name}
            autoFocus
            maxLength={40}
            error={error || undefined}
            placeholder={t("projectLabels.namePlaceholder")}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />

          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("fields.color")}</span>
            <ColorPicker
              value={color}
              onChange={setColor}
              swatchLabel={(c) => t("projectLabels.pickColor", { color: c })}
            />
          </div>

          <div className={styles.preview}>
            <span className={styles.previewLabel}>
              {t("projectLabels.preview")}
            </span>
            <Label color={color} filled>
              {trimmed || t("projectLabels.namePlaceholder")}
            </Label>
          </div>

          {/* Absenden per Enter — der Knopf unten liegt außerhalb des Formulars. */}
          <button type="submit" hidden />
        </form>
      </ModalBody>

      <ModalFooter hint={<ModalShortcut keys={["↵"]} />}>
        <Button variant="ghost" disabled={isPending} onClick={close}>
          {t("actions.cancel")}
        </Button>
        <Button
          variant="primary"
          disabled={!trimmed || isPending}
          onClick={submit}
        >
          {label ? t("actions.save") : t("actions.create")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
