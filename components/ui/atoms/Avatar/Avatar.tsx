"use client";
import { Icon } from "@iconify/react";
import { type CSSProperties, useState } from "react";
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
  /** Fürs Initialen-Kürzel, wenn Vor- und Nachname (beide optional) leer
   *  sind — der Benutzername ist der einzige Wert, der bei jeder Person
   *  garantiert existiert. */
  handle?: string;
};

export type AvatarData =
  | { name: string; color: string; image?: string }
  | PersonAvatarData;

export type AvatarShape = "circle" | "square";

interface AvatarProps {
  avatar: AvatarData | null;
  size?: number;
  /**
   * Schriftgröße der Initialen. Zahl = px, String = beliebiger CSS-Wert.
   * Ohne Angabe skaliert sie proportional zu `size`.
   */
  fontSize?: number | string;
  /**
   * Rund oder abgerundetes Quadrat. Standard: Personen rund,
   * benannte Entitäten (Workspace, Team, ...) quadratisch.
   */
  shape?: AvatarShape;
  ring?: boolean;
  /**
   * Ohne `avatar` statt nichts einen Platzhalter rendern — gestrichelter Ring
   * mit Personen-Icon, der die leere Zuweisung sichtbar macht.
   */
  placeholder?: boolean;
  /** Barrierefreier Name des Platzhalters, z. B. "Nicht zugewiesen". */
  placeholderLabel?: string;
  className?: string;
}

const toCssLength = (value: number | string) =>
  typeof value === "number" ? `${value}px` : value;

export function Avatar({
  avatar,
  size = 22,
  fontSize,
  shape,
  ring,
  placeholder,
  placeholderLabel,
  className,
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!avatar) {
    if (!placeholder) {
      return null;
    }

    return (
      <span
        className={[
          styles.avatar,
          styles[shape ?? "circle"],
          styles.placeholder,
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ "--avatar-size": `${size}px` } as CSSProperties}
        {...(placeholderLabel
          ? {
              role: "img",
              "aria-label": placeholderLabel,
              title: placeholderLabel,
            }
          : { "aria-hidden": true })}
      >
        <Icon icon="lucide:user" />
      </span>
    );
  }

  const isPerson = "firstName" in avatar;
  const color = avatar.color || "var(--primary)";
  const label = isPerson
    ? personInitials(avatar.firstName, avatar.lastName) ||
      avatar.firstName?.[0]?.toUpperCase() ||
      avatar.handle?.slice(0, 2).toUpperCase() ||
      "?"
    : initials(avatar.name) || avatar.name?.[0]?.toUpperCase() || "?";

  return (
    <span
      className={[
        styles.avatar,
        styles[shape ?? (isPerson ? "circle" : "square")],
        ring ? styles.ring : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-initials={label.length}
      style={
        {
          "--avatar-size": `${size}px`,
          "--avatar-bg": color,
          // Heller Text auf dunklem Grund und umgekehrt.
          "--avatar-fg": `oklch(from ${color} clamp(0.05, calc((0.60 - l) * 999), 0.95) 0 h)`,
          ...(fontSize !== undefined && {
            "--avatar-font-size": toCssLength(fontSize),
          }),
        } as CSSProperties
      }
    >
      {avatar.image && !imgFailed ? (
        <img
          src={avatar.image}
          alt=""
          className={styles.img}
          onError={() => setImgFailed(true)}
        />
      ) : (
        label
      )}
    </span>
  );
}

interface AvatarStackProps {
  ids: string[];
  users: User[];
  size?: number;
  max?: number;
  fontSize?: number | string;
  shape?: AvatarShape;
}

export function AvatarStack({
  ids,
  users,
  size = 22,
  max = 4,
  fontSize,
  shape,
}: AvatarStackProps) {
  const shown = ids.slice(0, max);
  const extra = ids.length - shown.length;
  const userById = (id: string) => users.find((u) => u.id === id) ?? null;
  const overlap = -Math.round(size * 0.3);

  return (
    <div className={styles.stack}>
      {shown.map((id, i) => (
        <span key={id} style={{ marginLeft: i ? overlap : 0, zIndex: 10 - i }}>
          <Avatar
            avatar={userById(id)}
            size={size}
            fontSize={fontSize}
            shape={shape}
            ring
          />
        </span>
      ))}
      {extra > 0 && (
        <span
          className={`${styles.avatar} ${styles[shape ?? "circle"]} ${styles.more}`}
          style={
            {
              marginLeft: overlap,
              "--avatar-size": `${size}px`,
              ...(fontSize !== undefined && {
                "--avatar-font-size": toCssLength(fontSize),
              }),
            } as CSSProperties
          }
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
