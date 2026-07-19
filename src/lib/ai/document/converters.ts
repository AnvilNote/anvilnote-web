import type { JSONContent } from "@tiptap/core";
import {
  ANVIL_NOTE_CALLOUT_KINDS,
  ANVIL_NOTE_QUESTION_KINDS,
  ANVIL_NOTE_WRITTEN_MODES,
  AnvilNoteDocumentFragmentV1Schema,
  AnvilNoteDocumentV1Schema,
  type AnvilNoteBlockNodeV1,
  type AnvilNoteCalloutKindV1,
  type AnvilNoteDocumentFragmentV1,
  type AnvilNoteDocumentV1,
  type AnvilNoteInlineNodeV1,
  type AnvilNoteMarkV1,
  type AnvilNoteQuestionKindV1,
  type AnvilNoteWrittenModeV1,
} from "@anvilnote/ai-writer/document";
import type { ProtectedSelectionRegistry } from "./protected-selection";

const BLOCKED_NODES = new Set([
  "image",
  "imageRow",
  "mermaid",
  "functionPlot",
  "statsChart",
  "inlineBlank",
  "questionBlank",
  "taskList",
  "taskItem",
]);
const PROTECTED_NODES = new Set([
  "footnotes",
  "footnote",
  "footnoteReference",
  "crossRef",
]);
const INLINE_SELECTION_NODES = new Set([
  "text",
  "hardBreak",
  "inlineMath",
  "footnoteReference",
  "crossRef",
]);

export class UnsupportedAIContentError extends Error {
  readonly code = "unsupported_selection";

  constructor(readonly nodeTypes: string[]) {
    super(`Smart Mode cannot safely convert: ${nodeTypes.join(", ")}`);
    this.name = "UnsupportedAIContentError";
  }
}

function attrs(node: JSONContent): Record<string, unknown> {
  return node.attrs ?? {};
}

function optionalString(value: unknown): string | null | undefined {
  return typeof value === "string" ? value : value === null ? null : undefined;
}

function calloutKind(value: unknown): AnvilNoteCalloutKindV1 {
  if (
    typeof value === "string" &&
    (ANVIL_NOTE_CALLOUT_KINDS as readonly string[]).includes(value)
  ) {
    return value as AnvilNoteCalloutKindV1;
  }
  throw new UnsupportedAIContentError(["callout.kind"]);
}

function calloutAttrs(node: JSONContent) {
  const values = attrs(node);
  for (const key of Object.keys(values)) {
    if (!["kind", "title", "titleTouched"].includes(key)) {
      throw new UnsupportedAIContentError([`callout.${key}`]);
    }
  }
  if (
    values.title !== undefined &&
    values.title !== null &&
    typeof values.title !== "string"
  ) {
    throw new UnsupportedAIContentError(["callout.title"]);
  }
  const title = typeof values.title === "string" ? values.title.trim() : "";
  return {
    kind: calloutKind(values.kind),
    title: title.length > 0 ? title : null,
  };
}

function assertNoAttrs(node: JSONContent): void {
  if (Object.keys(attrs(node)).length > 0) {
    throw new UnsupportedAIContentError([`${node.type}.attrs`]);
  }
}

function questionKind(value: unknown): AnvilNoteQuestionKindV1 {
  if (
    typeof value === "string" &&
    (ANVIL_NOTE_QUESTION_KINDS as readonly string[]).includes(value)
  ) {
    return value as AnvilNoteQuestionKindV1;
  }
  throw new UnsupportedAIContentError(["questionItem.kind"]);
}

function writtenMode(value: unknown): AnvilNoteWrittenModeV1 {
  if (
    typeof value === "string" &&
    (ANVIL_NOTE_WRITTEN_MODES as readonly string[]).includes(value)
  ) {
    return value as AnvilNoteWrittenModeV1;
  }
  throw new UnsupportedAIContentError(["questionItem.writtenMode"]);
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new UnsupportedAIContentError([field]);
  }
  return value;
}

function questionItemAttrs(node: JSONContent) {
  const values = attrs(node);
  const allowed = new Set([
    "kind",
    "writtenMode",
    "writtenLines",
    "writtenHeightPercent",
    "writtenHeightCm",
    "multiForceOneColumn",
    "stashedChoiceJSON",
  ]);
  for (const key of Object.keys(values)) {
    if (!allowed.has(key)) {
      throw new UnsupportedAIContentError([`questionItem.${key}`]);
    }
  }
  if (values.stashedChoiceJSON !== undefined && values.stashedChoiceJSON !== null) {
    throw new UnsupportedAIContentError(["questionItem.stashedChoiceJSON"]);
  }
  if (
    values.writtenHeightCm !== null &&
    (typeof values.writtenHeightCm !== "number" ||
      !Number.isFinite(values.writtenHeightCm))
  ) {
    throw new UnsupportedAIContentError(["questionItem.writtenHeightCm"]);
  }
  if (typeof values.multiForceOneColumn !== "boolean") {
    throw new UnsupportedAIContentError(["questionItem.multiForceOneColumn"]);
  }
  return {
    kind: questionKind(values.kind),
    writtenMode: writtenMode(values.writtenMode),
    writtenLines: requiredNumber(values.writtenLines, "questionItem.writtenLines"),
    writtenHeightPercent: requiredNumber(
      values.writtenHeightPercent,
      "questionItem.writtenHeightPercent",
    ),
    writtenHeightCm: values.writtenHeightCm as number | null,
    multiForceOneColumn: values.multiForceOneColumn,
  };
}

function marks(input: JSONContent["marks"]): AnvilNoteMarkV1[] | undefined {
  if (!input?.length) return undefined;
  return input.map((mark): AnvilNoteMarkV1 => {
    if (["bold", "italic", "strike", "code", "underline"].includes(mark.type)) {
      return { type: mark.type } as AnvilNoteMarkV1;
    }
    if (mark.type === "link") {
      const link = mark.attrs ?? {};
      return {
        type: "link",
        attrs: {
          href: String(link.href ?? ""),
          ...(link.title !== undefined ? { title: optionalString(link.title) } : {}),
          ...(link.target !== undefined
            ? { target: optionalString(link.target) as "_blank" | "_self" | null }
            : {}),
        },
      };
    }
    throw new UnsupportedAIContentError([`mark:${mark.type}`]);
  });
}

function inline(
  node: JSONContent,
  registry?: ProtectedSelectionRegistry,
): AnvilNoteInlineNodeV1 {
  if (PROTECTED_NODES.has(node.type ?? "")) {
    if (!registry) throw new UnsupportedAIContentError([node.type ?? "unknown"]);
    return {
      type: "text",
      text: registry.protect(node, "inline"),
    };
  }
  switch (node.type) {
    case "text":
      if (!node.text) throw new UnsupportedAIContentError(["empty-text"]);
      return {
        type: "text",
        text: node.text,
        ...(marks(node.marks) ? { marks: marks(node.marks) } : {}),
      };
    case "hardBreak":
      return { type: "hardBreak" };
    case "inlineMath":
      return { type: "inlineMath", attrs: { latex: String(attrs(node).latex ?? "") } };
    default:
      throw new UnsupportedAIContentError([node.type ?? "unknown"]);
  }
}

function cellAttrs(node: JSONContent) {
  const values = attrs(node);
  for (const key of ["fill", "stroke", "inset", "breakable", "verticalAlign"]) {
    if (values[key] !== null && values[key] !== undefined) {
      throw new UnsupportedAIContentError([`${node.type}.${key}`]);
    }
  }
  return {
    colspan: Number(values.colspan ?? 1),
    rowspan: Number(values.rowspan ?? 1),
    ...(values.colwidth !== undefined
      ? { colwidth: values.colwidth as number[] | null }
      : {}),
  };
}

function block(
  node: JSONContent,
  registry?: ProtectedSelectionRegistry,
): AnvilNoteBlockNodeV1 {
  const content = node.content ?? [];
  if (PROTECTED_NODES.has(node.type ?? "")) {
    if (!registry) throw new UnsupportedAIContentError([node.type ?? "unknown"]);
    return {
      type: "paragraph",
      content: [{ type: "text", text: registry.protect(node, "block") }],
    };
  }
  if (BLOCKED_NODES.has(node.type ?? "")) {
    throw new UnsupportedAIContentError([node.type ?? "unknown"]);
  }
  switch (node.type) {
    case "paragraph":
      return { type: "paragraph", content: content.map((child) => inline(child, registry)) };
    case "heading": {
      const values = attrs(node);
      return {
        type: "heading",
        attrs: {
          level: Number(values.level) as 1 | 2 | 3,
          ...(values.id !== undefined ? { id: optionalString(values.id) } : {}),
        },
        content: content.map((child) => inline(child, registry)),
      };
    }
    case "bulletList":
      return { type: "bulletList", content: content.map((child) => block(child, registry)) as never };
    case "orderedList":
      return {
        type: "orderedList",
        ...(attrs(node).start !== undefined
          ? { attrs: { start: Number(attrs(node).start) } }
          : {}),
        content: content.map((child) => block(child, registry)) as never,
      };
    case "listItem":
      return { type: "listItem", content: content.map((child) => block(child, registry)) };
    case "blockquote":
      return { type: "blockquote", content: content.map((child) => block(child, registry)) };
    case "callout":
      return {
        type: "callout",
        attrs: calloutAttrs(node),
        content: content.map((child) => block(child, registry)) as never,
      };
    case "proof":
      assertNoAttrs(node);
      return {
        type: "proof",
        content: content.map((child) => block(child, registry)) as never,
      };
    case "question":
      assertNoAttrs(node);
      return {
        type: "question",
        content: content.map((child) => block(child, registry)) as never,
      };
    case "questionItem":
      return {
        type: "questionItem",
        attrs: questionItemAttrs(node),
        content: content.map((child) => block(child, registry)) as never,
      };
    case "choiceList":
      assertNoAttrs(node);
      return {
        type: "choiceList",
        content: content.map((child) => block(child, registry)) as never,
      };
    case "choiceItem":
      assertNoAttrs(node);
      return {
        type: "choiceItem",
        content: content.map((child) => block(child, registry)) as never,
      };
    case "codeBlock":
      return {
        type: "codeBlock",
        attrs: { language: String(attrs(node).language ?? "plaintext") },
        content: content.map((child) => inline(child, registry)) as never,
      };
    case "blockMath": {
      const values = attrs(node);
      return {
        type: "mathBlock",
        attrs: {
          latex: String(values.latex ?? ""),
          ...(values.id !== undefined ? { id: optionalString(values.id) } : {}),
          ...(values.equationNumber !== undefined
            ? { equationNumber: optionalString(values.equationNumber) }
            : {}),
          ...(values.refName !== undefined ? { refName: optionalString(values.refName) } : {}),
        },
      };
    }
    case "table": {
      const values = attrs(node);
      const tableAttrs = {
        ...(values.id !== undefined ? { id: optionalString(values.id) } : {}),
        ...(values.caption !== undefined ? { caption: String(values.caption) } : {}),
        ...(values.variant !== undefined
          ? { variant: values.variant as "normal" | "three-line" }
          : {}),
        ...(values.align !== undefined
          ? { align: values.align as "left" | "center" | "right" }
          : {}),
      };
      return {
        type: "table",
        ...(Object.keys(tableAttrs).length ? { attrs: tableAttrs } : {}),
        content: content.map((child) => block(child, registry)) as never,
      };
    }
    case "tableRow":
      return {
        type: "tableRow",
        ...(attrs(node).rowHeight !== undefined
          ? { attrs: { rowHeight: attrs(node).rowHeight as number | null } }
          : {}),
        content: content.map((child) => block(child, registry)) as never,
      };
    case "tableHeader":
    case "tableCell":
      return {
        type: node.type,
        attrs: cellAttrs(node),
        content: content.map((child) => block(child, registry)),
      };
    case "horizontalRule":
      return {
        type: "horizontalRule",
        ...(Object.keys(attrs(node)).length
          ? {
              attrs: {
                ...(attrs(node).thicknessPt !== undefined
                  ? { thicknessPt: Number(attrs(node).thicknessPt) }
                  : {}),
                ...(attrs(node).lineStyle !== undefined
                  ? { lineStyle: attrs(node).lineStyle as "solid" | "dashed" | "dotted" | "dashdot" }
                  : {}),
              },
            }
          : {}),
      };
    default:
      throw new UnsupportedAIContentError([node.type ?? "unknown"]);
  }
}

export function tiptapDocumentToAnvilNote(document: JSONContent): AnvilNoteDocumentV1 {
  if (document.type !== "doc") throw new UnsupportedAIContentError([document.type ?? "unknown"]);
  return AnvilNoteDocumentV1Schema.parse({
    schemaVersion: "anvilnote.document.v1",
    type: "doc",
    content: (document.content ?? []).map((node) => block(node)),
  });
}

export function tiptapSelectionToAnvilNote(
  content: JSONContent[],
  registry?: ProtectedSelectionRegistry,
): AnvilNoteDocumentFragmentV1 {
  // A ProseMirror TextSelection wholly inside one paragraph serializes its
  // Slice.content as inline nodes (for example [{ type: "text", ... }]), while
  // the public fragment contract deliberately starts at block nodes. Preserve
  // the selection and its marks by restoring the implicit paragraph wrapper.
  const blocks = content.length > 0 && content.every((node) => INLINE_SELECTION_NODES.has(node.type ?? ""))
    ? [{ type: "paragraph", content }]
    : content;
  return AnvilNoteDocumentFragmentV1Schema.parse({
    schemaVersion: "anvilnote.fragment.v1",
    type: "fragment",
    content: blocks.map((node) => block(node, registry)),
  });
}

function tiptapMarks(input: AnvilNoteMarkV1[] | undefined): JSONContent["marks"] {
  return input?.map((mark) =>
    mark.type === "link" ? { type: mark.type, attrs: { ...mark.attrs } } : { type: mark.type },
  );
}

function tiptapInline(node: AnvilNoteInlineNodeV1): JSONContent {
  switch (node.type) {
    case "text":
      return { type: "text", text: node.text, ...(node.marks ? { marks: tiptapMarks(node.marks) } : {}) };
    case "hardBreak":
      return { type: "hardBreak" };
    case "inlineMath":
      return { type: "inlineMath", attrs: { ...node.attrs } };
  }
}

function tiptapBlock(node: AnvilNoteBlockNodeV1): JSONContent {
  switch (node.type) {
    case "paragraph":
      return { type: "paragraph", content: node.content.map(tiptapInline) };
    case "heading":
      return { type: "heading", attrs: { ...node.attrs }, content: node.content.map(tiptapInline) };
    case "bulletList":
    case "listItem":
    case "blockquote":
      return { type: node.type, content: node.content.map(tiptapBlock) };
    case "orderedList":
      return { type: "orderedList", ...(node.attrs ? { attrs: { ...node.attrs } } : {}), content: node.content.map(tiptapBlock) };
    case "codeBlock":
      return { type: "codeBlock", attrs: { ...node.attrs }, content: node.content.map(tiptapInline) };
    case "mathBlock":
      return { type: "blockMath", attrs: { ...node.attrs } };
    case "callout":
      return {
        type: "callout",
        attrs: {
          kind: node.attrs.kind,
          title: node.attrs.title ?? "",
          titleTouched: node.attrs.title !== null,
        },
        content: node.content.map(tiptapBlock),
      };
    case "proof":
      return { type: "proof", content: node.content.map(tiptapBlock) };
    case "question":
      return { type: "question", content: node.content.map(tiptapBlock) };
    case "questionItem":
      return {
        type: "questionItem",
        attrs: { ...node.attrs, stashedChoiceJSON: null },
        content: node.content.map(tiptapBlock),
      };
    case "choiceList":
      return { type: "choiceList", content: node.content.map(tiptapBlock) };
    case "choiceItem":
      return { type: "choiceItem", content: node.content.map(tiptapBlock) };
    case "table":
      return { type: "table", ...(node.attrs ? { attrs: { ...node.attrs } } : {}), content: node.content.map(tiptapBlock) };
    case "tableRow":
      return { type: "tableRow", ...(node.attrs ? { attrs: { ...node.attrs } } : {}), content: node.content.map(tiptapBlock) };
    case "tableHeader":
    case "tableCell":
      return { type: node.type, attrs: { ...node.attrs }, content: node.content.map(tiptapBlock) };
    case "horizontalRule":
      return { type: "horizontalRule", ...(node.attrs ? { attrs: { ...node.attrs } } : {}) };
  }
}

export function anvilNoteDocumentToTiptap(documentInput: AnvilNoteDocumentV1): JSONContent {
  const document = AnvilNoteDocumentV1Schema.parse(documentInput);
  return { type: "doc", content: document.content.map(tiptapBlock) };
}

export function anvilNoteFragmentToTiptap(
  fragmentInput: AnvilNoteDocumentFragmentV1,
  registry?: ProtectedSelectionRegistry,
): JSONContent[] {
  const fragment = AnvilNoteDocumentFragmentV1Schema.parse(fragmentInput);
  const converted = fragment.content.map(tiptapBlock);
  return registry ? registry.restore(converted) : converted;
}
