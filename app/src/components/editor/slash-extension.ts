import { Extension, type Range } from "@tiptap/core";
import { Suggestion, type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { filterSlashItems, readRecent, rememberUse, type SlashContext, type SlashEntry } from "./slash-items";

export type SlashState = {
  entries: SlashEntry[];
  query: string;
  rect: DOMRect | null;
  select: (entry: SlashEntry) => void;
  close: () => void;
} | null;

/** Puente entre el plugin de ProseMirror y el menú React. */
export type SlashBridge = {
  update: (state: SlashState) => void;
  keyDown: (e: KeyboardEvent) => boolean;
  /** Contexto de la aplicación vigente (lo actualiza el editor; el plugin se crea una sola vez). */
  context: () => SlashContext | null;
};

export const SlashCommand = Extension.create<{ bridge: SlashBridge | null }>({
  name: "slashCommand",
  addOptions: () => ({ bridge: null }),
  addProseMirrorPlugins() {
    const { bridge } = this.options;
    const editor = this.editor;
    const toState = (p: SuggestionProps<SlashEntry, SlashEntry>): SlashState => ({
      entries: p.items,
      query: p.query,
      rect: p.clientRect?.() ?? null,
      select: (entry) => p.command(entry),
      // «Cerrar menú»: igual que Escape (el texto escrito se queda).
      close: () => editor.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    });
    return [
      Suggestion<SlashEntry, SlashEntry>({
        editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        // Texto «/consulta» con la píldora y el marcador «Escribe para buscar» de Notion.
        decorationClass: "nd-slash-query",
        decorationEmptyClass: "is-empty",
        items: ({ query }) => filterSlashItems(query, readRecent()),
        command: ({ editor: e, range, props }: { editor: unknown; range: Range; props: SlashEntry }) => {
          rememberUse(props.item.id);
          props.item.run(e as never, range, bridge?.context() ?? null);
        },
        render: () => ({
          onStart: (p) => bridge?.update(toState(p)),
          onUpdate: (p) => bridge?.update(toState(p)),
          onKeyDown: (p: SuggestionKeyDownProps) => bridge?.keyDown(p.event) ?? false,
          onExit: () => bridge?.update(null),
        }),
      }),
    ];
  },
});
