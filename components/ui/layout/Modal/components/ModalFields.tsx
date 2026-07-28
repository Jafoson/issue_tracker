import styles from "../modal.module.scss";

type ModalTitleInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: React.Ref<HTMLInputElement>;
};

/**
 * Rahmenloses Titelfeld für Composer-Modals — sieht aus wie die Überschrift des
 * entstehenden Datensatzes, nicht wie ein Formularfeld. Für gelabelte Eingaben
 * stattdessen den `Input`-Atom verwenden.
 */
export function ModalTitleInput({ className, ...rest }: ModalTitleInputProps) {
  return (
    <input
      className={[styles.titleInput, className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}

type ModalTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: React.Ref<HTMLTextAreaElement>;
};

/** Rahmenloses Beschreibungsfeld als Gegenstück zum `ModalTitleInput`. */
export function ModalTextarea({ className, ...rest }: ModalTextareaProps) {
  return (
    <textarea
      className={[styles.textarea, className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
