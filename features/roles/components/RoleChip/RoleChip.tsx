import { roleColor } from "@/lib/rbac";
import styles from "./roleChip.module.scss";

interface Props {
  name: string;
  /** Rang der Rolle — er bestimmt die Farbe des Punktes. */
  rank: number;
  /** Herkunft der Rolle („Projektlokal"), falls sie eine hat. */
  tag?: string | null;
  /** Nicht bearbeitbar — der Chip tritt dann zurück. */
  locked?: boolean;
  className?: string;
}

/**
 * Der Name einer Rolle als Chip — mit ihrer Herkunft im selben Feld.
 *
 * Nicht `components/ui/atoms/Label`: dessen gefüllte Variante färbt Fläche,
 * Rahmen *und* Schrift aus einer Farbe, und die Rangfarben tragen das nicht.
 * Bei `--outline` (Rang 1) und `--amber` steht der Name blass auf blass, und
 * der farbige Punkt daneben verschwindet im gleichfarbigen Text. Hier trägt
 * die Farbe nur der Punkt, den Namen liest man in `--on-surface` — dieselbe
 * Aufteilung wie im Kopf der Matrix, die dieselben Rollen zeigt.
 *
 * Die Herkunft steht als zweites Feld im Chip statt als eigene Pille daneben:
 * „Projektlokal" ist eine Eigenschaft dieser Rolle, kein zweiter Gegenstand
 * neben ihr — und zwei gleich große Kästen nebeneinander lassen offen, welcher
 * der Name ist.
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
