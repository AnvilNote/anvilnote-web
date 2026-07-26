import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const ORDERED_DEPTHS = 5;
const BULLET_MARKERS = ["•", "◦", "▪", "–"] as const;
const CIRCLED_NUMBERS = [
  "①",
  "②",
  "③",
  "④",
  "⑤",
  "⑥",
  "⑦",
  "⑧",
  "⑨",
  "⑩",
  "⑪",
  "⑫",
  "⑬",
  "⑭",
  "⑮",
  "⑯",
  "⑰",
  "⑱",
  "⑲",
  "⑳",
] as const;

function alphabetic(number: number) {
  let value = Math.max(1, number);
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(97 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function orderedMarker(number: number, depth: number) {
  switch (Math.min(Math.max(depth, 1), ORDERED_DEPTHS)) {
    case 1:
      return `${number}.`;
    case 2:
      return `(${number})`;
    case 3:
      return CIRCLED_NUMBERS[number - 1] ?? `${number}.`;
    case 4:
      return `${alphabetic(number)}.`;
    default:
      return `(${alphabetic(number)})`;
  }
}

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

export const ListMarkers = Extension.create({
  name: "listMarkers",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos, parent, index) => {
              if (node.type.name !== "listItem" || !parent) return;

              const parentType = parent.type.name;
              if (parentType !== "bulletList" && parentType !== "orderedList") return;
              const depth = listDepthAt(state.doc, pos, parentType);
              const marker =
                parentType === "orderedList"
                  ? orderedMarker(
                      (typeof parent.attrs.start === "number" ? parent.attrs.start : 1) +
                        index,
                      depth,
                    )
                  : parentType === "bulletList"
                    ? BULLET_MARKERS[
                        Math.min(Math.max(depth - 1, 0), BULLET_MARKERS.length - 1)
                      ]
                    : null;
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
