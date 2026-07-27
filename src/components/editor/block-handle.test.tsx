import { act, render, screen } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { describe, expect, it, vi } from "vitest";
import { BlockHandle } from "./block-handle";

const dragHandleState = vi.hoisted(() => ({
  onNodeChange: null as
    | ((data: { node: PMNode | null; pos: number }) => void)
    | null,
}));

vi.mock("@tiptap/extension-drag-handle-react", () => ({
  DragHandle: ({
    className,
    onNodeChange,
    children,
  }: {
    className: string;
    onNodeChange: (data: { node: PMNode | null; pos: number }) => void;
    children: React.ReactNode;
  }) => {
    dragHandleState.onNodeChange = onNodeChange;
    return (
      <div data-testid="drag-handle" className={className}>
        {children}
      </div>
    );
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => () => "拖曳區塊",
}));

describe("BlockHandle", () => {
  it("moves farther left only for list items", () => {
    render(<BlockHandle editor={{} as Editor} />);

    act(() => {
      dragHandleState.onNodeChange?.({
        node: { type: { name: "listItem" } } as PMNode,
        pos: 1,
      });
    });
    expect(screen.getByTestId("drag-handle")).toHaveClass(
      "anvil-drag-handle--list",
    );

    act(() => {
      dragHandleState.onNodeChange?.({
        node: { type: { name: "paragraph" } } as PMNode,
        pos: 1,
      });
    });
    expect(screen.getByTestId("drag-handle")).not.toHaveClass(
      "anvil-drag-handle--list",
    );
  });
});
