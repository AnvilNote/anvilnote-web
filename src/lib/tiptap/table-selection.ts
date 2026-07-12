import type { EditorState, Transaction } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";

export function setCellAttributesAcrossSelection(
  state: EditorState,
  attributes: Record<string, unknown>,
): Transaction | null {
  if (!(state.selection instanceof CellSelection)) return null;
  const transaction = state.tr;
  state.selection.forEachCell((cell, position) => {
    const changed = Object.entries(attributes).some(
      ([name, value]) => cell.attrs[name] !== value,
    );
    if (changed) {
      transaction.setNodeMarkup(position, undefined, {
        ...cell.attrs,
        ...attributes,
      });
    }
  });
  return transaction;
}

export function setCellAttributeAcrossSelection(
  state: EditorState,
  name: string,
  value: unknown,
): Transaction | null {
  return setCellAttributesAcrossSelection(state, { [name]: value });
}
