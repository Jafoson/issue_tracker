import styles from "./badge.module.scss";


type BadgeProps = {
  size?: "sm" | "md";
  active?: boolean;
  mono?: boolean;
  dot?: boolean ;
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
  const cls = [
    styles.chip,
    active && styles.active,
    mono && styles.mono,
    size === "sm" && styles.sm,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={cls} style={style} {...rest}>
      {dot && <span className={styles.dot} />}
      {children}
    </Tag>
  );
}
