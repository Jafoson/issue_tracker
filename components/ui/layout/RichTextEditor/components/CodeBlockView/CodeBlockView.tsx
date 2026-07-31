"use client";

import { Icon } from "@iconify/react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { CopyButton } from "@/components/ui/layout/CopyButton/CopyButton";
import {
  CODE_LANGUAGES,
  countLines,
  languageLabel,
  PLAIN_LANGUAGE,
} from "@/lib/richtext/code";
import styles from "./codeBlockView.module.scss";

/**
 * Der Codeblock im Editor: Kopfzeile mit Sprachwahl und Kopierknopf, daneben
 * die Zeilennummern.
 *
 * Als React-Ansicht (`NodeView`), weil im Kopf ein Menü sitzt — mit dem
 * schlichten `renderHTML` von Tiptap ginge das nicht.
 *
 * Die Nummern stehen bewusst **nicht** im bearbeitbaren Bereich: ProseMirror
 * verwaltet dessen Inhalt, jedes eingeschobene Element käme ihm in die Quere.
 * Sie liegen deshalb in einer eigenen Spalte daneben, deren Zeilenhöhe mit der
 * des Codes übereinstimmt.
 */
export function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const t = useTranslations("editor");
  const language = node.attrs.language as string | null;
  const code = node.textContent;
  const lines = countLines(code);

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
                { value: "", label: PLAIN_LANGUAGE },
                ...CODE_LANGUAGES.map((l) => ({
                  value: l.value,
                  label: l.label,
                })),
              ]}
              value={language ?? ""}
              onPick={(value) => {
                // Leer heißt „keine Sprache" — als `null`, damit der Knoten
                // kein leeres Attribut mit sich trägt.
                updateAttributes({ language: value ? String(value) : null });
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
        {/* Nur zum Ansehen — und außerhalb des bearbeitbaren Bereichs. */}
        <div
          className={styles.gutter}
          contentEditable={false}
          aria-hidden="true"
        >
          {Array.from({ length: lines }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: die Zeilennummer *ist* der Index
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        {/* `<pre><code>` wie in der Anzeige. Der Typ steht ausdrücklich da:
            `NodeViewContent` leitet ihn wegen `NoInfer` nicht aus `as` ab. */}
        <pre className={styles.code}>
          <NodeViewContent<"code"> as="code" />
        </pre>
      </div>
    </NodeViewWrapper>
  );
}
