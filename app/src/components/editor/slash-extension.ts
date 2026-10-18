import { Extension, type Range } from "@tiptap/core";
import { Suggestion, type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { filterSlashItems, type SlashItem } from "./slash-items";

export type SlashState = {
  items: SlashItem[];
  rect: DOMRect | null;
  select: (item: SlashItem) => void;
} | null;

/** Puente entre el plugin de ProseMirror y el menú React. */
export type SlashBridge = {
  update: (state: SlashState) => void;
  keyDown: (e: KeyboardEvent) => boolean;
};

export const SlashCommand = Extension.create<{ bridge: SlashBridge | null }>({
  name: "slashCommand",
  addOptions: () => ({ bridge: null }),
  addProseMirrorPlugins() {
    const bridge = this.options.bridge;
    const toState = (p: SuggestionProps<SlashItem, SlashItem>): SlashState => ({
      items: p.items,
      rect: p.clientRect?.() ?? null,
      select: (item) => p.command(item),
    });
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => filterSlashItems(query),
        command: ({ editor, range, props }: { editor: unknown; range: Range; props: SlashItem }) =>
          props.run(editor as never, range),
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
