import type { Editor, JSONContent } from "@tiptap/core";
import { closeHistory, undo } from "@tiptap/pm/history";
import { Fragment } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { buildEditSnapshot } from "@anvilnote/ai-writer";
import { tiptapDocumentToAiSnapshotSource } from "./converters";
import { tiptapSelectionToEditSnapshot } from "./selection-snapshot";

export interface AIApplyRange {
  from: number;
  to: number;
}

export function isEmptyEditorDocument(editor: Editor): boolean {
  const { doc } = editor.state;
  return (
    doc.childCount === 1 &&
    Boolean(doc.firstChild?.isTextblock) &&
    doc.firstChild?.content.size === 0
  );
}

function applyAIContentTransaction(
  editor: Editor,
  range: AIApplyRange,
  content: JSONContent[],
  transactionGuard?: { key: PluginKey; token: object },
): boolean {
  if (
    content.length === 0 ||
    range.from < 0 ||
    range.to < range.from ||
    range.to > editor.state.doc.content.size
  ) {
    return false;
  }

  // A chain shares one ProseMirror transaction. closeHistory on that same
  // transaction starts a new undo group; the empty marker dispatched after
  // it prevents the user's next edit from joining the AI operation.
  const chain = editor
    .chain()
    .command(({ tr }) => {
      closeHistory(tr);
      tr.setMeta("addToHistory", true);
      if (transactionGuard) {
        tr.setMeta(transactionGuard.key, transactionGuard.token);
      }
      return true;
    });

  const replacesWholeDocument =
    range.from === 0 && range.to === editor.state.doc.content.size;
  const applied = replacesWholeDocument
    ? chain
        .command(({ tr }) => {
          const nodes = content.map((node) => editor.schema.nodeFromJSON(node));
          nodes.forEach((node) => node.check());
          tr.replaceWith(0, tr.doc.content.size, Fragment.fromArray(nodes));
          tr.setSelection(TextSelection.near(tr.doc.resolve(tr.doc.content.size), -1));
          return true;
        })
        .run()
    : chain
        .insertContentAt(range, content, {
          updateSelection: true,
          errorOnInvalidContent: true,
        })
        .run();

  if (applied) {
    const historyBoundary = closeHistory(editor.state.tr);
    if (transactionGuard) {
      historyBoundary.setMeta(transactionGuard.key, transactionGuard.token);
    }
    editor.view.dispatch(historyBoundary);
  }
  return applied;
}

export function applyAIContent(
  editor: Editor,
  range: AIApplyRange,
  content: JSONContent[],
): boolean {
  return applyAIContentTransaction(editor, range, content);
}

/**
 * Applies a reviewed inline proposal without allowing a block node to split
 * or replace the surrounding paragraph. Like applyAIContent(), this remains a
 * single, history-eligible editor operation.
 */
export function applyInlineAIContent(
  editor: Editor,
  range: AIApplyRange,
  content: JSONContent[],
): boolean {
  if (
    range.from < 0 ||
    range.to < range.from ||
    range.to > editor.state.doc.content.size
  ) {
    return false;
  }

  try {
    const nodes = content.map((node) => editor.schema.nodeFromJSON(node));
    if (nodes.some((node) => !node.isInline)) return false;
    const replacement = Fragment.fromArray(nodes);
    const transaction = editor.state.tr;
    closeHistory(transaction);
    transaction.setMeta("addToHistory", true);
    transaction.replaceWith(range.from, range.to, replacement);
    const selectionPosition = Math.min(
      range.from + replacement.size,
      transaction.doc.content.size,
    );
    transaction.setSelection(
      TextSelection.near(transaction.doc.resolve(selectionPosition), -1),
    );
    editor.view.dispatch(transaction);
    editor.view.dispatch(closeHistory(editor.state.tr));
    return true;
  } catch {
    return false;
  }
}

/**
 * Applies a reviewed proposal that itself spans more than one paragraph or
 * heading. Only valid when `range` covers a block's entire content (the
 * caller must check isWholeBlockSelection first) — the replacement then
 * lands at that block's own open/close boundaries, so several new blocks can
 * take the place of the one that stood there instead of being spliced into
 * running inline text.
 */
export function applyInlineAIBlocks(
  editor: Editor,
  range: AIApplyRange,
  blocks: JSONContent[],
): boolean {
  if (
    blocks.length === 0 ||
    range.from < 0 ||
    range.to < range.from ||
    range.to > editor.state.doc.content.size
  ) {
    return false;
  }

  try {
    const $from = editor.state.doc.resolve(range.from);
    const $to = editor.state.doc.resolve(range.to);
    if ($from.parent !== $to.parent) return false;
    const outerFrom = $from.before();
    const outerTo = $to.after();

    const nodes = blocks.map((node) => editor.schema.nodeFromJSON(node));
    nodes.forEach((node) => node.check());
    const replacement = Fragment.fromArray(nodes);
    const transaction = editor.state.tr;
    closeHistory(transaction);
    transaction.setMeta("addToHistory", true);
    transaction.replaceWith(outerFrom, outerTo, replacement);
    const selectionPosition = Math.min(
      outerFrom + replacement.size,
      transaction.doc.content.size,
    );
    transaction.setSelection(
      TextSelection.near(transaction.doc.resolve(selectionPosition), -1),
    );
    editor.view.dispatch(transaction);
    editor.view.dispatch(closeHistory(editor.state.tr));
    return true;
  } catch {
    return false;
  }
}

// --- Task 24.3: atomic accept/reject for a full-structure edit-operations
// draft --------------------------------------------------------------
//
// The candidate document an "edit-operations" draft carries is ALREADY the
// fully-verified, fully-rehydrated result of the API having run
// ai-writer's own applyEditOperations (Phase 23) — this module's job is
// purely: (1) verify the LIVE document still matches what the draft was
// computed against (a staleness/conflict check, since the user may have
// kept editing after the AI turn returned), (2) checkpoint the pre-accept
// state as a real document version, (3) apply the trusted candidate via
// ONE in-place ProseMirror transaction (reusing applyAIContent's own
// whole-document-replace branch above, so Undo works), and (4) persist it.
// Never a remount-based replacement (unlike replaceWholeDocumentFromAI in
// document-store.ts): a remount would lose Tiptap's own live undo stack
// entirely, which fails the hard product requirement that a single Undo
// right after Accept must undo the WHOLE AI change (spec 20.6). No
// apply-engine call happens here — re-running applyEditOperations
// client-side would require re-deriving nodeRefs/protectedImages state
// this side doesn't have; the draft's own candidate is already trusted.

// A persisted document's own on-the-wire shape: a one-element array
// wrapping a real Tiptap `doc` node (see anvilnote-api's
// editSnapshotCandidateToPersistedDocument, which produces exactly this).
export interface AiEditAcceptCandidateDocument {
  readonly type: "doc";
  readonly content: JSONContent[];
}

// Deliberately a purpose-built subset, not the full
// `AIConversationEditOperationsDraft` (runtime-client.ts) — this function
// only ever needs the three server-sent hash/candidate fields, plus
// `selectionRange` (the ORIGINAL selection's `{from,to}` that was active
// when the turn was submitted — NOT part of the server-sent draft at all;
// it comes from this client's own `operations` tracking map, the same
// mechanism the OLD compose/rewrite-selection flow already uses for its
// own "is this selection still valid" check — see smart-mode-panel.tsx's
// `DraftOperation`/`selectionSnapshot`). `null` means "this turn was
// document-scoped, there is no selection to re-verify" and must always be
// paired with a `null` `baseSelectionHash` — the caller owns constructing
// a consistent pair; this function only relies on that invariant.
export interface AiEditAcceptDraft {
  readonly baseDocumentHash: string;
  readonly baseSelectionHash: string | null;
  readonly selectionRange: AIApplyRange | null;
  readonly candidate: readonly [AiEditAcceptCandidateDocument];
}

// Narrow function shapes (not the real document-store methods themselves)
// so this module stays testable without a real Zustand store or network
// layer. smart-mode-panel.tsx supplies a `snapshotBeforeAIInsert`-backed
// `createVersion` and a persist-without-remount `saveDocument` — see that
// file's own header comment for exactly which store methods get passed in
// and why.
export interface AcceptEditDependencies {
  createVersion(live: JSONContent): Promise<unknown>;
  saveDocument(json: JSONContent): Promise<unknown>;
}

function currentDocumentHash(editor: Editor): string {
  const source = tiptapDocumentToAiSnapshotSource(editor.getJSON());
  return buildEditSnapshot(source).baseDocumentHash;
}

function assertMatchingDocumentHash(editor: Editor, expected: string): void {
  if (currentDocumentHash(editor) !== expected) {
    throw new Error("selection_conflict");
  }
}

// A no-op when `expected` is null (a document-scoped turn never had a
// selection to re-verify). Otherwise requires BOTH a still-valid `range`
// (within the live document's current bounds) and a matching real
// SHA-256-backed hash over that exact range — reusing
// `tiptapSelectionToEditSnapshot` (Task 24.1) rather than re-implementing
// selection hashing here.
function assertMatchingSelectionHash(
  editor: Editor,
  expected: string | null,
  range: AIApplyRange | null,
): void {
  if (expected === null) return;
  if (!range || range.from < 0 || range.to < range.from || range.to > editor.state.doc.content.size) {
    throw new Error("selection_conflict");
  }
  const { baseSelectionHash } = tiptapSelectionToEditSnapshot(editor, range);
  if (baseSelectionHash !== expected) {
    throw new Error("selection_conflict");
  }
}

function assertProtectedImagesUnchanged(
  live: JSONContent,
  candidate: AiEditAcceptCandidateDocument,
): void {
  try {
    const expected = buildEditSnapshot(tiptapDocumentToAiSnapshotSource(live)).protectedImages;
    const actual = buildEditSnapshot(tiptapDocumentToAiSnapshotSource(candidate)).protectedImages;
    if (
      actual.length !== expected.length ||
      actual.some((record, index) => record.canonicalSubtree !== expected[index]?.canonicalSubtree)
    ) {
      throw new Error("conversion_failed");
    }
  } catch {
    throw new Error("conversion_failed");
  }
}

const activeAccepts = new WeakSet<Editor>();

export async function acceptVerifiedEditDraft(
  editor: Editor,
  draft: AiEditAcceptDraft,
  dependencies: AcceptEditDependencies,
): Promise<void> {
  const live = editor.getJSON();
  assertMatchingDocumentHash(editor, draft.baseDocumentHash);
  assertMatchingSelectionHash(editor, draft.baseSelectionHash, draft.selectionRange);

  const candidateDocument = draft.candidate[0];
  if (!candidateDocument || candidateDocument.type !== "doc") {
    throw new Error("conversion_failed");
  }
  assertProtectedImagesUnchanged(live, candidateDocument);

  if (activeAccepts.has(editor)) {
    throw new Error("selection_conflict");
  }
  activeAccepts.add(editor);

  const guardKey = new PluginKey("anvilnote-ai-accept-guard");
  const guardToken = {};
  const rollbackToken = {};
  const wasEditable = editor.options.editable;
  let guardInstalled = false;
  try {
    editor.registerPlugin(new Plugin({
      key: guardKey,
      filterTransaction(transaction) {
        const token = transaction.getMeta(guardKey);
        if (token === guardToken || token === rollbackToken) return true;
        const appendedTransaction = transaction.getMeta("appendedTransaction");
        const appendedToken = appendedTransaction?.getMeta(guardKey);
        return appendedToken === guardToken || appendedToken === rollbackToken;
      },
    }));
    guardInstalled = true;
    editor.setEditable(false, false);

    // Checkpoint the pre-accept state BEFORE mutating anything — mirrors
    // applyAIContent's own callers (insertDraft's `snapshotBeforeAIInsert`),
    // and per this task's own plan, must run and complete before the replace
    // transaction is ever dispatched.
    await dependencies.createVersion(live);

    const range: AIApplyRange = { from: 0, to: editor.state.doc.content.size };
    const applied = applyAIContentTransaction(
      editor,
      range,
      candidateDocument.content,
      { key: guardKey, token: guardToken },
    );
    if (!applied) {
      throw new Error("conversion_failed");
    }

    try {
      await dependencies.saveDocument(editor.getJSON());
    } catch (error) {
      // The guard makes the AI event deterministically newest: no UI,
      // programmatic, or appended document transaction can land during
      // either await unless it is derived from the tagged AI transaction.
      // Tagging the history transaction with its own private token therefore
      // pops exactly that one event and does not admit another synchronous
      // programmatic write or add a rollback event of its own.
      undo(editor.state, (transaction) => {
        transaction.setMeta(guardKey, rollbackToken);
        editor.view.dispatch(transaction);
      });
      throw error;
    }
  } finally {
    if (guardInstalled) {
      editor.unregisterPlugin(guardKey);
    }
    if (!editor.isDestroyed) {
      editor.setEditable(wasEditable, false);
    }
    activeAccepts.delete(editor);
  }
}
