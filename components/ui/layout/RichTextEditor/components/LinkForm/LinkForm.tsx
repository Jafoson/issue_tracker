"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import styles from "./linkForm.module.scss";

/**
 * The address bar for a link.
 *
 * Replaces the `window.prompt` the toolbar button used to use: that blocks
 * the browser, can't be styled, and shows a different label depending on the
 * system.
 *
 * Positioned like the date picker popover — attached to the cursor by the
 * caller.
 */

/**
 * Turns an input into a usable address.
 *
 * Whoever sets a link rarely types the scheme along with it. If it's
 * missing, `https://` is added — except for the forms that are unambiguous
 * even without one: an email address, a path within the application, an
 * anchor target.
 *
 * Anything that still carries no allowed scheme after that counts as
 * unusable. That way `javascript:` never even makes it into the document —
 * the same policy as in `RichText`, just one level earlier.
 */
export function toHref(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (/^(?:https?:\/\/|mailto:|\/|#)/i.test(value)) return value;
  // An `@` without a scheme is an email address.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  // Any other scheme (`javascript:`, `data:`) isn't completed but rejected —
  // otherwise it would turn into `https://javascript:…`.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;

  return `https://${value}`;
}

interface LinkFormProps {
  /** Preset — the address of a link the cursor is already on. */
  initial?: string;
  /** Preset for the name. */
  initialName?: string;
  /**
   * Whether a name is asked for. Off when text is selected — that then
   * becomes the name, and a second field would only be misleading.
   */
  withName?: boolean;
  onSubmit: (href: string, name: string) => void;
  /** Removes the link from the selection. Missing when there isn't one yet. */
  onRemove?: () => void;
  onCancel: () => void;
  label: string;
  placeholder: string;
  nameLabel: string;
  namePlaceholder: string;
  applyLabel: string;
  removeLabel: string;
}

export function LinkForm({
  initial = "",
  initialName = "",
  withName = false,
  onSubmit,
  onRemove,
  onCancel,
  label,
  placeholder,
  nameLabel,
  namePlaceholder,
  applyLabel,
  removeLabel,
}: LinkFormProps) {
  const [value, setValue] = useState(initial);
  const [name, setName] = useState(initialName);
  const href = toHref(value);

  const submit = () => {
    if (href) onSubmit(href, name.trim());
  };

  /** Enter commits, Escape cancels — the same in both fields. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
    // Don't let this bubble up to the modal — otherwise the panel would close.
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className={styles.form}>
      <div className={styles.row}>
        <Icon icon="lucide:link" width={15} className={styles.icon} />
        <input
          // biome-ignore lint/a11y/noAutofocus: the row opens on request, and focus belongs in it immediately
          autoFocus
          type="url"
          inputMode="url"
          className={styles.input}
          aria-label={label}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />

        {onRemove && (
          <button
            type="button"
            className={styles.action}
            aria-label={removeLabel}
            title={removeLabel}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onRemove}
          >
            <Icon icon="lucide:link-2-off" width={15} />
          </button>
        )}
        <button
          type="button"
          className={styles.action}
          aria-label={applyLabel}
          title={applyLabel}
          // Without a valid address, there's nothing to commit.
          disabled={!href}
          onMouseDown={(e) => e.preventDefault()}
          onClick={submit}
        >
          <Icon icon="lucide:check" width={15} />
        </button>
      </div>

      {withName && (
        <div className={styles.row}>
          <Icon icon="lucide:type" width={15} className={styles.icon} />
          <input
            type="text"
            className={styles.input}
            aria-label={nameLabel}
            placeholder={namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
      )}
    </div>
  );
}
