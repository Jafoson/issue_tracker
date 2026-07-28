import styles from "./modal.module.scss";

interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Panel-Breite. Zahl = px, sonst beliebiger CSS-Wert. Default: 560px. */
  width?: number | string;
}

/**
 * Panel-Hülle für Modal-Inhalte: Fläche, Rahmen, Radius, Schatten und
 * Spalten-Layout. Erwartet als Kinder die Modal-Regionen in dieser Reihenfolge:
 * `ModalHeader` → `ModalBody` → `ModalToolbar` → `ModalFooter`. Nur der Body
 * wächst und scrollt, die übrigen Regionen bleiben fix sichtbar.
 *
 * Overlay, Backdrop, Escape-Handling und Fokus-Rückgabe kommen vom
 * `ModalFrame` in `lib/context/ModalContext` — hier bewusst nicht dupliziert,
 * damit jedes Modal über `openModal()` dasselbe Verhalten bekommt.
 */
export function Modal({
  width,
  className,
  style,
  children,
  ...rest
}: ModalProps) {
  return (
    <div
      className={[styles.modal, className].filter(Boolean).join(" ")}
      style={
        width === undefined
          ? style
          : ({
              ...style,
              "--modal-w": typeof width === "number" ? `${width}px` : width,
            } as React.CSSProperties)
      }
      {...rest}
    >
      {children}
    </div>
  );
}

type ModalBodyProps = React.HTMLAttributes<HTMLDivElement>;

/** Scrollender Inhaltsbereich des Modals. */
export function ModalBody({ className, children, ...rest }: ModalBodyProps) {
  return (
    <div
      className={[styles.body, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

interface ModalToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Trennlinie nach oben. Default: true. */
  divider?: boolean;
}

/**
 * Umbrechende Leiste für Attribut-Picker (Status, Priorität, Assignee …)
 * zwischen Body und Footer.
 */
export function ModalToolbar({
  divider = true,
  className,
  children,
  ...rest
}: ModalToolbarProps) {
  return (
    <div
      className={[styles.toolbar, divider && styles.dividerAbove, className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
