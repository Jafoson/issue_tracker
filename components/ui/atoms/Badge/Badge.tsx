import styles from "./badge.module.scss";

type BadgeVariant = "chip" | "count";
type BadgeSize = "sm" | "md";

type BadgeProps = {
  variant?: BadgeVariant;
  active?: boolean;
  mono?: boolean;
  dot?: string;
  size?: BadgeSize;
} & React.HTMLAttributes<HTMLElement> & {
    as?: "span" | "div" | "button";
    disabled?: boolean;
  };

export function Badge({
  children,
  variant = "chip",
  active = false,
  mono = false,
  dot,
  size = "md",
  as: Tag = "span",
  className,
  style,
  ...rest
}: BadgeProps) {
  const cls = [
    variant === "count" ? styles.count : styles.chip,
    active && styles.active,
    mono && styles.mono,
    size === "sm" && styles.sm,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={cls} style={style} {...rest}>
      {dot && <span className={styles.dot} style={{ background: dot }} />}
      {children}
    </Tag>
  );
}
