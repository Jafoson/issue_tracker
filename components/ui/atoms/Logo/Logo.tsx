import Image from "next/image";
import styles from "./logo.module.scss";

type LogoVariant = "mark" | "horizontal" | "vertical";
type LogoColor = "color" | "black" | "white" | "grey_dark" | "grey_light";

const FILES: Record<LogoVariant, string> = {
  mark: "Logo.svg",
  horizontal: "Logo_horizontal.svg",
  vertical: "Logo_vertikal.svg",
};

// Intrinsic SVG viewBox sizes (public/Logo/**) — next/image needs a
// width/height to size the box; the mark and vertical lockup are square,
// the horizontal lockup is wider.
const INTRINSIC: Record<LogoVariant, { width: number; height: number }> = {
  mark: { width: 260, height: 260 },
  horizontal: { width: 788, height: 260 },
  vertical: { width: 260, height: 260 },
};

interface LogoProps {
  variant?: LogoVariant;
  color?: LogoColor;
  height?: number;
  className?: string;
  priority?: boolean;
}

export function Logo({
  variant = "mark",
  color = "color",
  height = 32,
  className,
  priority,
}: LogoProps) {
  const intrinsic = INTRINSIC[variant];
  const width = Math.round((intrinsic.width / intrinsic.height) * height);

  return (
    <Image
      src={`/Logo/${color}/${FILES[variant]}`}
      alt="Barynt"
      width={width}
      height={height}
      className={[styles.logo, className].filter(Boolean).join(" ")}
      priority={priority}
    />
  );
}
