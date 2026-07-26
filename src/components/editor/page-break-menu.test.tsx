import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { PageBreak } from "@/lib/tiptap/page-break";
import { PageBreakMenu } from "./page-break-menu";

const labels = {
  trigger: "Page break",
  forced: "Forced page break",
  forcedHint: "Always start on the next page",
  weak: "Smart page break",
  weakHint: "Avoid another break when already at the top",
};

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("PageBreakMenu", () => {
  it("opens on every click and inserts the selected page-break mode", async () => {
    const user = userEvent.setup();
    editor = new Editor({
      extensions: [StarterKit, PageBreak],
      content: { type: "doc", content: [{ type: "paragraph" }] },
    });
    render(<PageBreakMenu editor={editor} labels={labels} />);

    const trigger = screen.getByRole("button", { name: labels.trigger });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: /Smart page break/ }));

    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: /Forced page break/ }));

    expect(
      editor
        .getJSON()
        .content?.filter((node) => node.type === "pageBreak")
        .map((node) => node.attrs?.weak),
    ).toEqual([true, false]);
  });
});
