"use client";
import { initials, personInitials } from "@/lib/utils/string";
import type { User } from "@/types";
import styles from "./avatar.module.scss";

// Zwei Varianten: benannte Entitäten (Workspace, ...) mit einem einzelnen `name`,
// und Personen (User) mit getrennten `firstName`/`lastName` für korrekte Initialen.
export type PersonAvatarData = {
  firstName: string;
  lastName: string;
  color: string;
  image?: string;
};

export type AvatarData =
  | { name: string; color: string; image?: string }
  | PersonAvatarData;

interface AvatarProps {
  avatar: AvatarData | null;
  size?: number;
  ring?: boolean;
}

export function Avatar({ avatar, size = 22, ring }: AvatarProps) {
  if (!avatar) {
    return;
  }

  const color = avatar.color || "var(--primary)";
  const label =
    "firstName" in avatar
      ? personInitials(avatar.firstName, avatar.lastName) ||
        avatar.firstName?.[0]?.toUpperCase() ||
        "?"
      : initials(avatar.name) || avatar.name?.[0]?.toUpperCase() || "?";

  return (
    <span
      className={`${styles.avatar} ${ring ? styles.ring : ""}`}
      style={{
        width: size,
        height: size,
        position: "relative",
        background: color,
        color: `oklch(from ${color} clamp(0.05, calc((0.60 - l) * 999), 0.95) 0 h)`,
        fontSize: `clamp(var(--text-xxs), ${size * 0.6}px, var(--text-2xl))`,
      }}
    >
      {label}
    </span>
  );
}

interface AvatarStackProps {
  ids: string[];
  users: User[];
  size?: number;
  max?: number;
}

export function AvatarStack({
  ids,
  users,
  size = 22,
  max = 4,
}: AvatarStackProps) {
  const shown = ids.slice(0, max);
  const extra = ids.length - shown.length;
  const userById = (id: string) => users.find((u) => u.id === id) ?? null;

  return (
    <div className={styles.stack}>
      {shown.map((id, i) => (
        <span key={id} style={{ marginLeft: i ? -7 : 0, zIndex: 10 - i }}>
          <Avatar avatar={userById(id)} size={size} ring />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="avatar"
          style={{
            marginLeft: -7,
            width: size,
            height: size,
            background: "var(--elev)",
            color: "var(--text-2)",
            fontSize: size * 0.4,
            boxShadow: "0 0 0 2px var(--panel)",
          }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
