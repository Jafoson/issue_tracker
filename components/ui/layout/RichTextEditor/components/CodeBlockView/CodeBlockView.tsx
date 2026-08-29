"use client";

import { Icon } from "@iconify/react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { CopyButton } from "@/components/ui/layout/CopyButton/CopyButton";
import {
  CODE_LANGUAGES,
  countLines,
  languageLabel,
  PLAIN_LANGUAGE,
  PLAIN_VALUE,
} from "@/lib/richtext/code";
import { detectLanguage } from "@/lib/richtext/highlight";
import styles from "./codeBlockView.module.scss";

/**
 * The code block in the editor: header with language selector and copy
 * button, line numbers alongside.
 *
 * As a React view (`NodeView`), because a menu sits in the header — that
 * wouldn't be possible with Tiptap's plain `renderHTML`.
 *
 * The numbers deliberately sit **outside** the editable area: ProseMirror
 * manages its content, and any inserted element would get in its way. They
 * therefore live in their own column next to it, whose line height matches
 * that of the code.
 */
export function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const t = useTranslations("editor");
  const language = node.attrs.language as string | null;
  const code = node.textContent;
  const lines = countLines(code);

  /**
   * Detects the language as long as none is chosen — once, shortly after
   * typing or pasting.
   *
   * The result moves into the node as an attribute. After that, `language`
   * is set and detection stops running: the colors stay fixed instead of
   * being re-guessed on every character. Whoever picks something else in the
   * menu — including "Plain" — keeps it.
   */
  useEffect(() => {
    if (language !== null) return;
    const timer = setTimeout(() => {
      const erkannt = detectLanguage(code);
      if (erkannt) updateAttributes({ language: erkannt });
    }, 600);
    return () => clearTimeout(timer);
  }, [language, code, updateAttributes]);

  return (
    <NodeViewWrapper className={styles.block}>
      <div className={styles.head} contentEditable={false}>
        <InlinePicker
          width={220}
          trigger={
            <button type="button" className={styles.lang}>
              {languageLabel(language)}
              <Icon icon="lucide:chevron-down" width={12} />
            </button>
          }
        >
          {(close) => (
            <SelectMenu
              items={[
                { value: PLAIN_VALUE, label: PLAIN_LANGUAGE },
                ...CODE_LANGUAGES.map((l) => ({
                  value: l.value,
                  label: l.label,
                })),
              ]}
              value={language ?? PLAIN_VALUE}
              onPick={(value) => {
                updateAttributes({ language: String(value) });
                close();
              }}
              onClose={close}
              searchable
            />
          )}
        </InlinePicker>

        <CopyButton value={code} label={t("copy")} copiedLabel={t("copied")} />
      </div>

      <div className={styles.body}>
        {/* Display only — and outside the editable area. */}
        <div
          className={styles.gutter}
          contentEditable={false}
          aria-hidden="true"
        >
          {Array.from({ length: lines }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the line number *is* the index
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        {/* `<pre><code>` like in the display path. The type is spelled out
            explicitly: `NodeViewContent` doesn't infer it from `as` because
            of `NoInfer`. */}
        <pre className={styles.code}>
          <NodeViewContent<"code"> as="code" />
        </pre>
      </div>
    </NodeViewWrapper>
  );
}
