"use client";

import { useState } from "react";
import { initials } from "@/lib/utils/string";
import type { User } from "@/types";
import styles from "./avatar.module.scss";

interface AvatarProps {
  user: User | null;
  size?: number;
  ring?: boolean;
}

export function Avatar({ user, size = 22, ring }: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const ringStyle = ring
    ? { boxShadow: "0 0 0 2px var(--panel), inset 0 0 0 1px rgba(255,255,255,.12)" }
    : undefined;

  if (!user) {
    return (
      <span
        className="avatar"
        style={{
          width: size, height: size,
          background: "transparent",
          border: "1.4px dashed var(--text-3)",
          color: "var(--text-3)",
          boxShadow: "none",
          fontSize: size * 0.5,
        }}
      >
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="8" r="3.4"/>
          <path d="M5 20a7 7 0 0 1 14 0"/>
        </svg>
      </span>
    );
  }

  if (user.image && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt={user.name}
        width={size}
        height={size}
        className={`avatar ${styles.img}`}
        style={{ width: size, height: size, ...ringStyle }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      className="avatar"
      style={{
        width: size, height: size,
        background: `linear-gradient(150deg, ${user.color}, color-mix(in oklab, ${user.color} 70%, #000))`,
        fontSize: Math.max(9, size * 0.42),
        ...ringStyle,
      }}
    >
      {initials(user.name)}
    </span>
  );
}

interface AvatarStackProps {
  ids: string[];
  users: User[];
  size?: number;
  max?: number;
}

export function AvatarStack({ ids, users, size = 22, max = 4 }: AvatarStackProps) {
  const shown = ids.slice(0, max);
  const extra = ids.length - shown.length;
  const userById = (id: string) => users.find((u) => u.id === id) ?? null;

  return (
    <div className={styles.stack}>
      {shown.map((id, i) => (
        <span key={id} style={{ marginLeft: i ? -7 : 0, zIndex: 10 - i }}>
          <Avatar user={userById(id)} size={size} ring />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="avatar"
          style={{
            marginLeft: -7,
            width: size, height: size,
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
