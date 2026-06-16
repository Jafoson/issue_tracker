"use client";

import { cloneElement, useRef, useState } from "react";
import { Popover } from "@/components/ui/atoms/Popover/Popover";

interface InlinePickerProps {
  trigger: React.ReactElement;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  width?: number;
  align?: "start" | "center" | "end";
  stop?: boolean;
}

export function InlinePicker({ trigger, children, width, align, stop }: InlinePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const close = () => setOpen(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const triggerWithRef = cloneElement(trigger as React.ReactElement<any>, {
    ref,
    onClick: (e: React.MouseEvent) => {
      if (stop) e.stopPropagation();
      setOpen((o) => !o);
    },
  });

  return (
    <>
      {triggerWithRef}
      <Popover anchorRef={ref} open={open} onClose={close} width={width} align={align}>
        {typeof children === "function" ? children(close) : children}
      </Popover>
    </>
  );
}
