"use client";

import { cloneElement, useRef, useState } from "react";
import { Popover } from "@/components/ui/atoms/Popover/Popover";
import styles from "./inlinePicker.module.scss";

interface InlinePickerProps {
  trigger: React.ReactElement;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  width?: number;
  maxWidth?: number;
  align?: "start" | "center" | "end";
  /**
   * Hält die Klicks des Pickers bei sich — die des Auslösers wie die der
   * Auswahl. Nötig, sobald er in etwas Anklickbarem sitzt (Board-Karte,
   * Listenzeile): das Menü hängt zwar in einem Portal, seine Ereignisse steigen
   * aber durch den React-Baum weiter zu dessen `onClick`.
   */
  stop?: boolean;
}

export function InlinePicker({
  trigger,
  children,
  width,
  maxWidth,
  align,
  stop,
}: InlinePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const close = () => setOpen(false);

  const triggerWithRef = cloneElement(
    trigger as React.ReactElement<{
      ref?: React.Ref<HTMLElement>;
      onClick?: (e?: React.MouseEvent) => void;
    }>,
    {
      ref,
      // Optional event: triggers activated via keyboard (e.g. Chip) call the
      // handler without one.
      onClick: (e?: React.MouseEvent) => {
        if (stop) e?.stopPropagation();
        setOpen((o) => !o);
      },
    },
  );

  const content = typeof children === "function" ? children(close) : children;

  return (
    <>
      {triggerWithRef}
      <Popover
        anchorRef={ref}
        open={open}
        onClose={close}
        width={width}
        maxWidth={maxWidth}
        align={align}
      >
        {stop ? (
          // Nur ein Riegel, kein Bedienelement: `display: contents` lässt das
          // Menü selbst das Kind des Popovers bleiben. Eine Tastaturvariante
          // braucht es nicht — der Riegel bedient nichts, er hält nur auf.
          // biome-ignore lint/a11y/useKeyWithClickEvents: kein Bedienelement, nur ein Riegel für fremde Klicks
          // biome-ignore lint/a11y/noStaticElementInteractions: fängt Klicks ab, die sonst im Aufrufer landen
          <div className={styles.seal} onClick={(e) => e.stopPropagation()}>
            {content}
          </div>
        ) : (
          content
        )}
      </Popover>
    </>
  );
}
