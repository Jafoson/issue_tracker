import { roleColor } from "@/lib/rbac";
import styles from "./roleChip.module.scss";

interface Props {
  name: string;
  /** Rank of the role — it determines the dot's color. */
  rank: number;
  /** Origin of the role ("Project-local"), if it has one. */
  tag?: string | null;
  /** Not editable — the chip recedes in that case. */
  locked?: boolean;
  className?: string;
}

/**
 * A role's name as a chip — with its origin in the same field.
 *
 * Not `components/ui/atoms/Label`: its filled variant colors fill, border,
 * *and* text from one color, and the rank colors can't carry that. At
 * `--outline` (rank 1) and `--amber` the name would sit pale on pale, and
 * the colored dot next to it would vanish into text of the same color.
 * Here, only the dot carries the color; the name is read in `--on-surface`
 * — the same split as in the matrix header, which shows the same roles.
 *
 * The origin sits as a second field inside the chip instead of as a
 * separate pill next to it: "Project-local" is a property of this role, not
 * a second object beside it — and two equal-sized boxes side by side would
 * leave it open which one is the name.
 */
export function RoleChip({ name, rank, tag, locked, className }: Props) {
  return (
    <span
      className={[styles.chip, className].filter(Boolean).join(" ")}
      data-locked={locked || undefined}
      title={name}
    >
      <span className={styles.name}>
        <span className={styles.dot} style={{ background: roleColor(rank) }} />
        <span className={styles.text}>{name}</span>
      </span>

      {tag && <span className={styles.tag}>{tag}</span>}
    </span>
  );
}
