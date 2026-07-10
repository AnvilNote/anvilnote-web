import { Extension, Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { createId } from "@/lib/utils/ids";
import { CrossRefNodeView } from "@/components/editor/node-views/cross-ref-node-view";

// Node type names this feature can point a reference at. Matches the CSS
// counter-driven numbering the editor already shows for images/tables
// (globals.css's anvil-figure/anvil-table counters) — this file doesn't
// duplicate THAT numbering (the CSS counters stay exactly as they are); it
// computes its own parallel count in the same top-to-bottom doc order
// purely to resolve what a crossRef pointing at a given figure/table
// should display, since a crossRef can sit anywhere in the document, not
// just right next to its target.
// imageRow included so it (and its child images — see the numbering pass
// below) gets a backfilled id too; imageRow itself shares "figure" numbering
// with plain standalone images (one number for the whole row), while its
// children get the new "figureSub" kind instead of "figure" — see the
// numbering pass's own imageRow branch for how that split is computed.
const TARGET_TYPES = new Set([
  "image",
  "table",
  "blockMath",
  "heading",
  "imageRow",
  "questionItem",
]);

export type CrossRefKind = "figure" | "figureSub" | "table" | "equation" | "heading" | "question";

// Backfills a stable `id` on every referenceable node (image/table/
// blockMath/heading), and — the actual cross-referencing logic — resolves
// every crossRef node's display value on each doc change. Mirrors
// tiptap-footnotes' own appendTransaction pattern (recomputing
// referenceNumber on every node of its kind, every transaction) almost
// exactly; the same shape, generalized to four target types instead of one.
//
// Numbering rules (decided with the user up front, not just an
// implementation detail):
//   - figures/tables: every instance gets a number, unconditionally —
//     matches the existing CSS counters, which don't gate on caption text
//     either.
//   - equations: ONLY block-math nodes that are actually targeted by at
//     least one crossRef get a number — display math isn't numbered by
//     default anywhere in this app today (unlike LaTeX/Typst's usual
//     default), so numbering every equation regardless of use would be a
//     visible behavior change beyond what cross-ref itself asked for.
//   - headings: not numbered at all (most of the 18 Typst templates don't
//     number headings, and the ones that do use incompatible per-template
//     schemes) — a heading crossRef resolves to the heading's own text
//     instead, which works identically across every template.
export const CrossRefTargetIds = Extension.create({
  name: "crossRefTargetIds",

  addGlobalAttributes() {
    return [
      {
        types: Array.from(TARGET_TYPES),
        attributes: {
          id: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-cross-ref-id"),
            renderHTML: (attributes) =>
              attributes.id ? { "data-cross-ref-id": attributes.id } : {},
          },
        },
      },
      {
        // Only meaningful on blockMath — see the equations rule above.
        // Kept as a plain attribute (not derived at render time) so the
        // math NodeView can show "(N)" without re-deriving it itself.
        types: ["blockMath"],
        attributes: {
          equationNumber: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-equation-number"),
            renderHTML: (attributes) =>
              attributes.equationNumber
                ? { "data-equation-number": attributes.equationNumber }
                : {},
          },
          // Optional user-given display name (set in the math dialog).
          // Purely an editor-side nicety: the @ suggestion list shows this
          // instead of the raw LaTeX source, which is unreadable as a list
          // label for anything beyond a trivial formula. Never exported.
          refName: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-ref-name"),
            renderHTML: (attributes) =>
              attributes.refName ? { "data-ref-name": attributes.refName } : {},
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("crossRefResolver"),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((t) => t.docChanged)) return null;

          const tr = newState.tr;
          let changed = false;

          // Pass 1: backfill missing ids. Subsequent passes read through
          // `tr.doc`, which already reflects these assignments — setNodeAttribute
          // mutates the transaction's working doc immediately, it isn't
          // deferred until dispatch.
          newState.doc.descendants((node, pos) => {
            if (TARGET_TYPES.has(node.type.name) && !node.attrs.id) {
              tr.setNodeAttribute(pos, "id", createId());
              changed = true;
            }
          });

          // Pass 2: which target ids does at least one crossRef actually
          // point at? Needed before numbering equations (only referenced
          // ones get a number) — a crossRef can point at a target that
          // appears earlier OR later in the doc, so this has to be a
          // separate pass, not folded into pass 3's single top-to-bottom walk.
          const referencedIds = new Set<string>();
          tr.doc.descendants((node) => {
            if (node.type.name === "crossRef" && node.attrs.targetId) {
              referencedIds.add(node.attrs.targetId as string);
            }
          });

          // Pass 3: assign figure/table/equation numbers and collect heading
          // text, walking the doc in document order (same order the CSS
          // counters implicitly use, so figure/table numbers always agree
          // with what's visually shown on the caption itself).
          let figureN = 0;
          let tableN = 0;
          let equationN = 0;
          let questionN = 0;
          const resolved = new Map<string, { kind: CrossRefKind; value: string }>();

          tr.doc.descendants((node, pos, parent) => {
            const id = node.attrs.id as string | null;

            // imageRow gets ONE figure number for the whole row; its child
            // images get "figureSub" instead ("圖 1 (a)"/"圖 1 (b)", not
            // "圖 1"/"圖 2" — see cross-ref-labels.ts's own figureSub case
            // for why that space-before-paren format, and mermaid-plan's
            // memo on why this is computed here rather than sourced from
            // subpar's own numbering). Handled before the generic `if (!id)
            // return` below since imageRow itself needs its id resolved
            // even though its children are walked manually via
            // node.forEach, not the generic recursive descendants — hence
            // `return false` to skip descending into them a second time.
            if (node.type.name === "imageRow") {
              figureN += 1;
              const rowValue = String(figureN);
              if (id) resolved.set(id, { kind: "figure", value: rowValue });
              let letterIndex = 0;
              node.forEach((child) => {
                const childId = child.attrs.id as string | null;
                if (child.type.name === "image" && childId) {
                  const letter = String.fromCharCode(97 + letterIndex);
                  // Space before the paren ("1 (a)") so formatCrossRefLabel's
                  // plain "{supplement} {value}" rule (same one "figure"
                  // itself uses) produces "圖 1 (a)" without figureSub
                  // needing its own special-cased join format.
                  resolved.set(childId, { kind: "figureSub", value: `${rowValue} (${letter})` });
                  letterIndex += 1;
                }
              });
              return false;
            }
            // Already handled as part of its parent imageRow above — skip,
            // don't let the plain "image" branch below double-count it.
            if (parent?.type.name === "imageRow") return;

            if (!id) return;

            if (node.type.name === "image") {
              figureN += 1;
              resolved.set(id, { kind: "figure", value: String(figureN) });
            } else if (node.type.name === "table") {
              tableN += 1;
              resolved.set(id, { kind: "table", value: String(tableN) });
            } else if (node.type.name === "blockMath") {
              if (referencedIds.has(id)) {
                equationN += 1;
                const value = String(equationN);
                // Always the sequence number, never refName — refName is
                // only a readable label for the @ suggestion list (see
                // cross-ref-suggestion.tsx's collectTargets), not a
                // substitute for the "式 (N)" display format. Confirmed
                // with the user directly: a named equation's crossRef
                // still shows "式 (1)", not the name.
                resolved.set(id, { kind: "equation", value });
                if (node.attrs.equationNumber !== value) {
                  tr.setNodeAttribute(pos, "equationNumber", value);
                  changed = true;
                }
              } else if (node.attrs.equationNumber != null) {
                tr.setNodeAttribute(pos, "equationNumber", null);
                changed = true;
              }
            } else if (node.type.name === "heading") {
              resolved.set(id, { kind: "heading", value: node.textContent });
            } else if (node.type.name === "questionItem") {
              questionN += 1;
              resolved.set(id, { kind: "question", value: String(questionN) });
            }
          });

          // Pass 4: write each crossRef's resolved display value (or mark
          // it broken, if its target no longer exists — e.g. the figure it
          // pointed at was deleted).
          tr.doc.descendants((node, pos) => {
            if (node.type.name !== "crossRef") return;
            const targetId = node.attrs.targetId as string | null;
            const target = targetId ? resolved.get(targetId) : undefined;
            const nextKind = target?.kind ?? null;
            const nextValue = target?.value ?? null;
            const nextBroken = !target;

            if (
              node.attrs.resolvedKind !== nextKind ||
              node.attrs.resolvedValue !== nextValue ||
              node.attrs.broken !== nextBroken
            ) {
              tr.setNodeAttribute(pos, "resolvedKind", nextKind);
              tr.setNodeAttribute(pos, "resolvedValue", nextValue);
              tr.setNodeAttribute(pos, "broken", nextBroken);
              changed = true;
            }
          });

          // Pass 4b: same as pass 4, but for questionBlank nodes (inline
          // cloze-style blanks that live-reference a questionItem's
          // number). Kept as its own walk rather than folded into pass 4's
          // crossRef walk above since questionBlank only stores
          // resolvedValue/broken, not resolvedKind — it only ever targets
          // one kind of thing (a question), so there's no ambiguity to
          // record.
          tr.doc.descendants((node, pos) => {
            if (node.type.name !== "questionBlank") return;
            const targetId = node.attrs.targetId as string | null;
            const raw = targetId ? resolved.get(targetId) : undefined;
            const target = raw?.kind === "question" ? raw : undefined;
            const nextValue = target?.value ?? null;
            const nextBroken = !target;

            if (node.attrs.resolvedValue !== nextValue || node.attrs.broken !== nextBroken) {
              tr.setNodeAttribute(pos, "resolvedValue", nextValue);
              tr.setNodeAttribute(pos, "broken", nextBroken);
              changed = true;
            }
          });

          return changed ? tr : null;
        },
        // blockMath's own NodeView (from @tiptap/extension-mathematics) is a
        // plain vanilla one that builds its DOM by hand and never calls
        // Tiptap's usual mergeAttributes(HTMLAttributes) — so a normal
        // renderHTML-based attribute (like equationNumber above) never
        // actually reaches its rendered element, only the ProseMirror model
        // (which is all the numbering plugin itself needs, and all the
        // Typst renderer reads). To still show "(N)" next to a referenced
        // equation in the editor without forking that third-party node's
        // internals, a node DECORATION adds the attribute onto its EXISTING
        // rendered DOM element after the fact; CSS (globals.css) then
        // displays it via ::after + attr(), the same attr()-driven-content
        // technique already used for image/table captions.
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name === "blockMath" && node.attrs.equationNumber) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    "data-equation-number": node.attrs.equationNumber,
                  }),
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

// The reference itself: an inline atom pointing at a target's stable id.
// `resolvedKind`/`resolvedValue`/`broken` are never set by the user —
// they're recomputed by CrossRefTargetIds's plugin on every doc change and
// are what the NodeView actually renders, so the displayed number/text
// always reflects the target's CURRENT position/content, not whatever it
// was when the reference was inserted.
export const CrossRef = Node.create({
  name: "crossRef",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      targetId: { default: null },
      resolvedKind: { default: null },
      resolvedValue: { default: null },
      broken: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="cross-ref"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-type": "cross-ref" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CrossRefNodeView);
  },
});

export function insertCrossRef(
  editor: import("@tiptap/core").Editor,
  targetId: string,
  range?: { from: number; to: number },
) {
  const chain = editor.chain().focus();
  if (range) chain.deleteRange(range);
  chain.insertContent({ type: "crossRef", attrs: { targetId } }).run();
}
