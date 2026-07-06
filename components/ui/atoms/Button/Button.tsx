import styles from "./button.module.scss";

type ButtonVariant = "primary" | "elevated" | "ghost" | "outline" | "text";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  textAlign?: "left" | "center" | "right";
}

export function Button({
  children,
  variant = "elevated",
  size = "md",
  full = false,
  icon,
  iconRight,
  className,
  textAlign = "center",
  ...rest
}: ButtonProps) {
  const isIconOnly = (!!icon || !!iconRight) && !children;

  const cls = [
    styles.btn,
    styles[variant],
    styles[size],
    full && styles.full,
    isIconOnly && styles.iconOnly,
    !isIconOnly && !!icon && styles.hasIcon,
    !isIconOnly && !!iconRight && styles.hasIconRight,
    textAlign && styles[`textAlign-${textAlign}`],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={cls} {...rest}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
}
