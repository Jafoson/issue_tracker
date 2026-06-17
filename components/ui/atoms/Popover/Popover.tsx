"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface PopoverProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
  width?: number;
  maxWidth?: number;
  offset?: number;
}

export function Popover({
  anchorRef,
  open,
  onClose,
  children,
  align = "start",
  side = "bottom",
  width,
  maxWidth,
  offset = 6,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a) return;
      const el = ref.current;
      const w = width ?? el?.offsetWidth ?? 220;
      const h = el?.offsetHeight ?? 200;
      let left =
        align === "end"
          ? a.right - w
          : align === "center"
            ? a.left + a.width / 2 - w / 2
            : a.left;
      let top = side === "top" ? a.top - h - offset : a.bottom + offset;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      if (top + h > window.innerHeight - 8) top = Math.max(8, a.top - h - offset);
      top = Math.max(8, top);
      setPos({ left, top });
    };
    place();
    const t = setTimeout(place, 0);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align, side, width, offset, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        ref.current?.contains(e.target as Node) ||
        anchorRef.current?.contains(e.target as Node)
      )
        return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={ref}
      className="menu"
      style={{
        position: "fixed",
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        width: width ?? undefined,
        maxWidth: maxWidth ?? undefined,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
