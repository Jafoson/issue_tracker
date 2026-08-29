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
  /** Visible widgets in their order. */
  order: WidgetKey[];
  /** Deselected widgets — they appear below and can be brought back. */
  hidden: WidgetKey[];
  close: () => void;
  /**
   * Save and reset come in as functions rather than the dialog calling the
   * server actions itself: the project and workspace dashboards share this
   * dialog, but use different actions and context ids
   * (`saveDashboardLayout`/`saveWorkspaceDashboardLayout`) — the dialog
   * itself doesn't need to know the difference.
   */
  onSave: (order: string[], hidden: string[]) => Promise<unknown>;
  onReset: () => Promise<unknown>;
}

/**
 * "Customize dashboard": which widgets appear, and in what order.
 *
 * ── Why a list and not dragging in a grid ──
 *
 * Moving the tiles directly would be the obvious gesture and the worse
 * solution: a grid with differently sized tiles has no unambiguous drop
 * targets, the target jumps around while dragging, and it can't be operated
 * with a keyboard at all. This list gives every widget two buttons, every
 * step moves one row, and everything about it works with tab and space.
 *
 * ── Close first, then take effect ──
 *
 * Unlike the toggles in account settings, this dialog doesn't write on every
 * click. Anyone reordering three widgets is taking three steps toward
 * **one** intention; three writes and three rebuilds of the page underneath
 * would be the same wait, three times over, for an intermediate result
 * nobody wanted to see. Hence a draft kept in state and one "save" at the
 * end — and a "cancel" that actually exists.
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

  // One shared order across *all* widgets, plus the set of deselected ones.
  // Keeping two separate lists would mean inventing a position every time
  // something is shown or hidden — this way a deselected widget keeps its
  // spot and reappears exactly there when brought back.
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

                {/* The key-figures row stays — without it, an empty dashboard
                    would offer no way back into this dialog. The switch is
                    still shown, just disabled: a missing control would be
                    harder to interpret than a locked one. */}
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
