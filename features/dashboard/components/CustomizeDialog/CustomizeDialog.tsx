"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Switch } from "@/components/ui/atoms/Switch/Switch";
import { ModalFooter } from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import {
  moveWidget,
  type WidgetKey,
  widgetDef,
} from "@/features/dashboard/widgets";
import styles from "./customizeDialog.module.scss";

interface Props {
  /** Sichtbare Bausteine in ihrer Reihenfolge. */
  order: WidgetKey[];
  /** Abgewählte Bausteine — sie stehen unten und lassen sich zurückholen. */
  hidden: WidgetKey[];
  close: () => void;
  /**
   * Speichern und Zurücksetzen kommen als Funktionen herein statt der Dialog
   * riefe die Server-Aktionen selbst: Projekt- und Workspace-Dashboard teilen
   * sich diesen Dialog, kennen aber unterschiedliche Aktionen und Kontext-Ids
   * (`saveDashboardLayout`/`saveWorkspaceDashboardLayout`) — der Dialog selbst
   * muss den Unterschied nicht kennen.
   */
  onSave: (order: string[], hidden: string[]) => Promise<unknown>;
  onReset: () => Promise<unknown>;
}

/**
 * „Dashboard anpassen": welche Bausteine stehen da, und in welcher Reihenfolge.
 *
 * ── Warum eine Liste und kein Ziehen im Raster ──
 *
 * Die Kacheln direkt zu verschieben wäre die naheliegende Geste und die
 * schlechtere Lösung: ein Raster mit unterschiedlich breiten Kacheln hat keine
 * eindeutigen Ablageplätze, das Ziel springt beim Ziehen, und mit der Tastatur
 * ist es gar nicht zu bedienen. Die Liste hier hat für jeden Baustein zwei
 * Knöpfe, jeder Schritt ist eine Zeile weit, und alles daran funktioniert mit
 * Tabulator und Leertaste.
 *
 * ── Erst schließen, dann wirksam ──
 *
 * Anders als die Schalter in den Kontoeinstellungen schreibt dieser Dialog nicht
 * bei jedem Klick. Wer drei Bausteine umsortiert, macht drei Schritte auf **eine**
 * Absicht hin; drei Schreibvorgänge und drei Neuaufbauten der Seite darunter
 * wären dreimal dieselbe Wartezeit für ein Zwischenergebnis, das niemand sehen
 * wollte. Deshalb ein Stand im Zustand und ein „Speichern" am Ende — und ein
 * „Abbrechen", das es auch wirklich gibt.
 */
export function CustomizeDialog({
  order: initialOrder,
  hidden: initialHidden,
  close,
  onSave,
  onReset,
}: Props) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  // Eine gemeinsame Reihenfolge über *alle* Bausteine, plus die Menge der
  // abgewählten. Zwei getrennte Listen zu führen hieße, beim Ein- und
  // Ausblenden jedes Mal eine Position erfinden zu müssen — so behält ein
  // abgewählter Baustein seinen Platz und steht beim Zurückholen wieder dort,
  // wo er war.
  const [order, setOrder] = useState<WidgetKey[]>([
    ...initialOrder,
    ...initialHidden,
  ]);
  const [hidden, setHidden] = useState<Set<WidgetKey>>(
    () => new Set(initialHidden),
  );

  const toggle = (key: WidgetKey, on: boolean) => {
    setHidden((current) => {
      const next = new Set(current);
      if (on) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const save = () => {
    startTransition(async () => {
      await onSave(order, [...hidden]);
      close();
    });
  };

  const reset = () => {
    startTransition(async () => {
      await onReset();
      close();
    });
  };

  return (
    <Modal width={460}>
      <ModalHeader
        title={t("dashboard.customize")}
        leading={<Icon icon="lucide:sliders-horizontal" width={16} />}
        onClose={close}
        closeLabel={t("actions.cancel")}
      />

      <ModalBody className={styles.body}>
        <p className={styles.intro}>{t("dashboard.customizeHint")}</p>

        <ul className={styles.list}>
          {order.map((key, index) => {
            const def = widgetDef(key);
            const on = !hidden.has(key);
            const label = t(`dashboard.widget_${key}`);

            return (
              <li key={key} className={styles.row} data-off={!on || undefined}>
                <span className={styles.moves}>
                  <button
                    type="button"
                    className={styles.move}
                    disabled={index === 0}
                    aria-label={t("dashboard.moveUp", { name: label })}
                    onClick={() => setOrder(moveWidget(order, key, -1))}
                  >
                    <Icon icon="lucide:chevron-up" width={14} />
                  </button>
                  <button
                    type="button"
                    className={styles.move}
                    disabled={index === order.length - 1}
                    aria-label={t("dashboard.moveDown", { name: label })}
                    onClick={() => setOrder(moveWidget(order, key, 1))}
                  >
                    <Icon icon="lucide:chevron-down" width={14} />
                  </button>
                </span>

                <Icon icon={def.icon} width={15} className={styles.icon} />
                <span className={styles.label}>{label}</span>

                {/* Die Kennzahlenreihe bleibt — ohne sie führte von einem leeren
                    Dashboard kein Weg zurück in diesen Dialog. Der Schalter
                    steht trotzdem da, nur stumpf: eine fehlende Stelle wäre
                    schwerer zu deuten als eine gesperrte. */}
                <Switch
                  checked={on}
                  disabled={def.permanent}
                  onChange={(next) => toggle(key, next)}
                  label={label}
                  labelHidden
                />
              </li>
            );
          })}
        </ul>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={reset} disabled={pending}>
          {t("dashboard.reset")}
        </Button>
        <Button variant="outline" onClick={close} disabled={pending}>
          {t("actions.cancel")}
        </Button>
        <Button variant="primary" onClick={save} disabled={pending}>
          {t("actions.save")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
