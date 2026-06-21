"use client";

import { Icon } from "@iconify/react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/atoms/Input/Input";
import { createLabel } from "@/features/issues/actions";
import type { Label } from "@/types";
import styles from "./labelPickerMenu.module.scss";

export const LABEL_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#84cc16",
  "#14b8a6",
  "#0ea5e9",
  "#a855f7",
  "#d946ef",
  "#64748b",
  "#f59e0b",
  "#10b981",
  "#e11d48",
  "#7c3aed",
];

interface Props {
  allLabels: Label[];
  selected: string[];
  projectId: string;
  projectName: string;
  workspaceId: string;
  onPick: (id: string) => void;
  onCreated: (label: Label) => void;
  onClose: () => void;
  keepOpen?: boolean;
}

export function LabelPickerMenu({
  allLabels,
  selected,
  projectId,
  projectName,
  workspaceId,
  onPick,
  onCreated,
  onClose,
  keepOpen,
}: Props) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{
    name: string;
    scope: "project" | "workspace";
  } | null>(null);
  const [, startCreate] = useTransition();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const visible = allLabels.filter(
    (l) => !l.projectId || l.projectId === projectId,
  );
  const filtered = q
    ? visible.filter((l) => l.name.toLowerCase().includes(q.toLowerCase()))
    : visible;

  const handleColorPick = (color: string) => {
    if (!pending) return;
    startCreate(async () => {
      const label = await createLabel({
        name: pending.name,
        color,
        workspaceId,
        projectId: pending.scope === "project" ? projectId : null,
      });
      onCreated({ ...label, projectId: label.projectId ?? null });
      onPick(label.id);
      setPending(null);
    });
  };

  if (pending) {
    return (
      <>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 4px 8px",
          }}
        >
          <button
            type="button"
            onClick={() => setPending(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-3)",
              display: "flex",
              padding: 2,
              borderRadius: "var(--radius-sm)",
            }}
          >
            <Icon icon="lucide:arrow-left" width={14} />
          </button>
          <span style={{ fontSize: 13, color: "var(--text-2)" }}>
            Farbe für{" "}
            <strong style={{ color: "var(--text)" }}>„{pending.name}"</strong>{" "}
            wählen
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            padding: "0 4px 4px",
            justifyContent: "center",
          }}
        >
          {LABEL_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleColorPick(color)}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: color,
                border: "2px solid transparent",
                cursor: "pointer",
                flexShrink: 0,
                transition: "transform 0.1s, border-color 0.1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "scale(1.2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "scale(1)";
              }}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <Input
        ref={inputRef}
        variant="search"
        size="sm"
        placeholder="Label suchen…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 4 }}
      />
      <div style={{ maxHeight: 240, overflowY: "auto", margin: "0 -1px" }}>
        {filtered.map((l) => (
          <label
            key={l.id}
            className={`menu-item ${styles.labelItem}${selected.includes(l.id) ? " active" : ""}`}
          >
            <input
              type="checkbox"
              className={styles.labelCheckbox}
              checked={selected.includes(l.id)}
              onChange={() => {
                onPick(l.id);
                if (!keepOpen) onClose();
              }}
            />
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: l.color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {l.name}
            </span>
          </label>
        ))}

        {filtered.length === 0 && q.trim() && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              padding: "2px 0",
            }}
          >
            <button
              type="button"
              className="menu-item"
              onClick={() => setPending({ name: q.trim(), scope: "project" })}
            >
              <Icon
                icon="lucide:plus"
                width={14}
                height={14}
                style={{ flexShrink: 0 }}
              />
              <span>
                „{q.trim()}" in <strong>{projectName}</strong> anlegen
              </span>
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => setPending({ name: q.trim(), scope: "workspace" })}
            >
              <Icon
                icon="lucide:plus"
                width={14}
                height={14}
                style={{ flexShrink: 0 }}
              />
              <span>„{q.trim()}" im Workspace anlegen</span>
            </button>
          </div>
        )}

        {filtered.length === 0 && !q.trim() && (
          <div className="menu-item faint" style={{ cursor: "default" }}>
            Keine Labels vorhanden
          </div>
        )}
      </div>
    </>
  );
}
