"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { Input } from "@/components/ui/atoms/Input/Input";

interface SelectItem {
  value: string | number | null;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
}

interface SelectMenuProps {
  items: SelectItem[];
  value: (string | number | null) | (string | number | null)[];
  onPick: (value: string | number | null) => void;
  onClose?: () => void;
  searchable?: boolean;
  placeholder?: string;
  multi?: boolean;
  footer?: React.ReactNode;
}

export function SelectMenu({
  items,
  value,
  onPick,
  onClose,
  searchable,
  placeholder,
  multi,
  footer,
}: SelectMenuProps) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchable) inputRef.current?.focus();
  }, [searchable]);

  const filtered = items.filter((it) =>
    it.label.toLowerCase().includes(q.toLowerCase()),
  );

  const isSel = (v: string | number | null) =>
    multi
      ? (value as (string | number | null)[]).includes(v)
      : value === v;

  return (
    <>
      {searchable && (
        <Input
          ref={inputRef}
          variant="search"
          size="sm"
          placeholder={placeholder ?? "Search…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ marginBottom: 4 }}
        />
      )}
      <div style={{ maxHeight: 280, overflowY: "auto", margin: "0 -1px" }}>
        {filtered.map((it) => (
          <div
            key={String(it.value)}
            className={`menu-item${isSel(it.value) ? " active" : ""}`}
            onClick={() => {
              onPick(it.value);
              if (!multi) onClose?.();
            }}
          >
            {it.icon}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
            {it.hint && (
              <span className="faint" style={{ marginLeft: "auto", fontSize: 12 }}>
                {it.hint}
              </span>
            )}
            {isSel(it.value) && (
              <span className="check" style={{ marginLeft: it.hint ? 8 : "auto" }}>
                <Icon icon="lucide:check" width={15} />
              </span>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="menu-item faint" style={{ cursor: "default" }}>
            No matches
          </div>
        )}
      </div>
      {footer}
    </>
  );
}
