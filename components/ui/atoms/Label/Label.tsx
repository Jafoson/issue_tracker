import styles from "./label.module.scss";

interface LabelProps {
  color?: string;
  size?: "sm" | "md";
  filled? : boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  hasIcon?: boolean;
}

export function Label({ color, size = "md", className, style, children, hasIcon, filled }: LabelProps) {
  return (
    <span
      className={[styles.label, size === "sm" && styles.sm, filled && styles.filled, className].filter(Boolean).join(" ")}
      style={{ "--label-color": color, ...style } as React.CSSProperties}
    >
      {color && !hasIcon && <span className={styles.dot} style={{ background: color }} />}
      {children}
    </span>
  );
}
