import type { Editor, Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import {
  type SuggestionItem,
  SuggestionMenu,
  type SuggestionMenuHandle,
} from "../components/SuggestionMenu/SuggestionMenu";
import styles from "../components/SuggestionMenu/suggestionMenu.module.scss";

/**
 * Der gemeinsame Unterbau aller vier Trigger (`@`, `#`, `:`, `/`).
 *
 * Jeder von ihnen unterscheidet sich nur in drei Punkten: welches Zeichen ihn
 * öffnet, welche Einträge er zeigt und was beim Wählen passiert. Alles andere —
 * Liste rendern, Tasten abfangen, ein- und ausblenden — steht hier einmal.
 *
 * Positioniert wird über `props.mount`: das hängt das Element per Floating UI
 * an den Cursor und hält es beim Scrollen und Umbrechen dort. Deshalb braucht
 * es hier weder eigene Koordinaten noch Listener.
 */

interface TriggerConfig<I extends SuggestionItem> {
  /**
   * Eindeutiger Name des Triggers — wird zum ProseMirror-Plugin-Schlüssel.
   *
   * Ohne ihn liefen alle vier unter dem Standardschlüssel `suggestion`, den
   * `@tiptap/suggestion` modulweit anlegt. ProseMirror lässt zwei verschiedene
   * Plugins unter demselben Schlüssel nicht zu und wirft beim Erzeugen des
   * Editors `RangeError: Adding different instances of a keyed plugin`.
   */
  name: string;
  char: string;
  /** Die Treffer zur aktuellen Eingabe. Darf asynchron sein. */
  items: (query: string) => I[] | Promise<I[]>;
  /** Setzt den gewählten Eintrag in das Dokument. */
  onSelect: (props: { editor: Editor; range: Range; item: I }) => void;
  /** Steht in der Liste, wenn nichts passt. */
  emptyLabel: () => string;
  /**
   * `/` gilt nur am Zeilenanfang — mitten im Satz ist ein Schrägstrich meist
   * ein Schrägstrich. Die Erwähnungen dagegen dürfen überall stehen.
   */
  startOfLine?: boolean;
  /** `allowSpaces` für Namen, die aus zwei Wörtern bestehen. */
  allowSpaces?: boolean;
}

export function createSuggestion<I extends SuggestionItem>({
  name,
  char,
  items,
  onSelect,
  emptyLabel,
  startOfLine = false,
  allowSpaces = false,
}: TriggerConfig<I>): Omit<SuggestionOptions<I>, "editor"> {
  return {
    pluginKey: new PluginKey(name),
    char,
    startOfLine,
    allowSpaces,
    items: ({ query }) => items(query),

    command: ({ editor, range, props }) => {
      onSelect({ editor, range, item: props });
    },

    render: () => {
      let renderer: ReactRenderer<SuggestionMenuHandle> | null = null;
      let unmount: (() => void) | null = null;

      return {
        onStart: (props) => {
          renderer = new ReactRenderer(SuggestionMenu, {
            editor: props.editor,
            // Die Hülle ist das Element, das Floating UI positioniert — und
            // damit das einzige, an dem eine Ebene überhaupt wirkt.
            className: styles.floating,
            props: {
              items: props.items,
              loading: props.loading,
              emptyLabel: emptyLabel(),
              command: (item: SuggestionItem) => props.command(item as I),
            },
          });
          unmount = props.mount(renderer.element as HTMLElement);
        },

        onUpdate: (props) => {
          renderer?.updateProps({
            items: props.items,
            loading: props.loading,
            emptyLabel: emptyLabel(),
            command: (item: SuggestionItem) => props.command(item as I),
          });
        },

        onKeyDown: (props) => {
          // Escape schließt nur die Liste. Es darf nicht weiter nach oben
          // laufen, sonst verwirft der Editor gleich die ganze Bearbeitung.
          if (props.event.key === "Escape") {
            props.event.stopPropagation();
            unmount?.();
            unmount = null;
            renderer?.destroy();
            renderer = null;
            return true;
          }
          return renderer?.ref?.onKeyDown(props.event) ?? false;
        },

        onExit: () => {
          unmount?.();
          unmount = null;
          renderer?.destroy();
          renderer = null;
        },
      };
    },
  };
}
