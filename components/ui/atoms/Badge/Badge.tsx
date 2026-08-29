import styles from "./badge.module.scss";

type BadgeProps = {
  size?: "sm" | "md";
  active?: boolean;
  mono?: boolean;
  dot?: boolean;
} & React.HTMLAttributes<HTMLElement> & {
    as?: "span" | "div" | "button";
    disabled?: boolean;
  };

export function Badge({
  children,
  active = false,
  mono = true,
  dot,
  size = "md",
  as: Tag = "span",
  className,
  style,
  ...rest
}: BadgeProps) {
  // A badge rendered as <button> is interactive by definition — cursor and
  // hover follow from that, no separate prop needed for it.
  const interactive = Tag === "button";

  const cls = [
    styles.chip,
    active && styles.active,
    mono && styles.mono,
    size === "sm" && styles.sm,
    interactive && styles.interactive,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag
      className={cls}
      style={style}
      type={interactive ? "button" : undefined}
      {...rest}
    >
      {dot && <span className={styles.dot} />}
      {children}
    </Tag>
  );
}
