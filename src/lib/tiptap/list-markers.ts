import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { renderOrderedMarker } from "@/lib/list-markers/marker-modules";

function listDepthAt(
  doc: Parameters<typeof DecorationSet.create>[0],
  pos: number,
  listType: "bulletList" | "orderedList",
) {
  const $pos = doc.resolve(pos + 1);
  let depth = 0;
  for (let index = $pos.depth; index > 0; index -= 1) {
    const name = $pos.node(index).type.name;
    if (name === listType) {
      depth += 1;
    } else if (name === "bulletList" || name === "orderedList") {
      break;
    }
  }
  return depth;
}

// depth is 1-based; levels[0] is depth 1. Wraps back to level 1 once depth
// exceeds however many levels the user has configured (matches the old
// hardcoded 5-level wrap-around behavior, just with a user-editable count).
function levelAt<T>(levels: readonly T[], depth: number): T {
  return levels[(Math.max(depth, 1) - 1) % levels.length];
}

export const ListMarkers = Extension.create({
  name: "listMarkers",

  addStorage() {
    return { unsubscribe: null as (() => void) | null };
  },

  // Ordered/unordered marker choices live in useSettingsStore, not in
  // ProseMirror state — decorations() below only re-runs when the editor's
  // OWN state changes, so a settings-only change would otherwise leave
  // already-rendered lists showing their old markers until the next edit.
  // Dispatching a no-op transaction forces ProseMirror to ask every
  // decoration-providing plugin again against the current (unchanged) doc.
  onCreate() {
    const editor = this.editor;
    this.storage.unsubscribe = useSettingsStore.subscribe((state, previous) => {
      if (
        state.orderedListLevels !== previous.orderedListLevels ||
        state.unorderedListLevels !== previous.unorderedListLevels
      ) {
        editor.view.dispatch(editor.state.tr);
      }
    });
  },

  onDestroy() {
    this.storage.unsubscribe?.();
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const { orderedListLevels, unorderedListLevels } = useSettingsStore.getState();
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos, parent, index) => {
              if (node.type.name !== "listItem" || !parent) return;

              const parentType = parent.type.name;
              if (parentType !== "bulletList" && parentType !== "orderedList") return;
              const depth = listDepthAt(state.doc, pos, parentType);
              const marker =
                parentType === "orderedList"
                  ? renderOrderedMarker(
                      levelAt(orderedListLevels, depth),
                      (typeof parent.attrs.start === "number" ? parent.attrs.start : 1) +
                        index,
                    )
                  : levelAt(unorderedListLevels, depth);
              if (!marker) return;

              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  "data-list-marker": marker,
                  "data-list-depth": String(depth),
                }),
              );
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
