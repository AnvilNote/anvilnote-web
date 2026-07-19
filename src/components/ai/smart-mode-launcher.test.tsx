import type { Editor } from "@tiptap/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEditorBridge } from "@/lib/stores/editor-bridge";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useSmartModeUIStore } from "@/lib/stores/smart-mode-ui-store";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("./smart-mode-panel", () => ({
  SmartModePanel: ({ open }: { open: boolean }) => open ? <div id="smart-mode-panel">panel</div> : null,
}));

import { SmartModeLauncher } from "./smart-mode-launcher";
import { DEFAULT_TOUR_POSITION } from "@/components/tour/tour-replay-button";

describe("SmartModeLauncher", () => {
  it("keeps the Bot at its independent bottom-right anchor", async () => {
    useSmartModeUIStore.setState({ open: false });
    useEditorBridge.setState({ editor: {} as Editor, documentId: "doc-1" });
    useSettingsStore.setState({ hideTourButton: false, tourButtonPosition: null });
    const user = userEvent.setup();
    render(<TooltipProvider><SmartModeLauncher /></TooltipProvider>);

    const button = screen.getByRole("button", { name: "smart.open" });
    expect(button).toHaveClass("fixed", "size-11", "sm:right-4", "sm:bottom-4");
    expect(DEFAULT_TOUR_POSITION.bottom).toBeGreaterThan(60);

    useSettingsStore.setState({ hideTourButton: true });
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveClass("invisible", "pointer-events-none");
    expect(screen.getByText("panel")).toBeInTheDocument();
  });
});
