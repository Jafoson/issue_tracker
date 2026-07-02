"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/atoms/Input/Input";
import SelectItem from "./atoms/SelectItem";
import styles from "./SelectMenu.module.scss";

export interface ISelectItem {
  value: string | number | null;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
}

interface SelectMenuProps {
  items: ISelectItem[];
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
    multi ? (value as (string | number | null)[]).includes(v) : value === v;

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
      <div className={styles.content}>
        {filtered.map((it) => (
          <SelectItem
            key={String(it.value)}
            it={it}
            isSel={isSel}
            onPick={onPick}
            onClose={onClose}
            multi={multi}
          />
        ))}
        {filtered.length === 0 && (
          <div className={`${styles.menuItem} ${styles.faint} ${styles["cursor-normal"]}`}>
            No matches
          </div>
        )}
      </div>
      {footer}
    </>
  );
}
