import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useSmartModeUIStore } from "@/lib/stores/smart-mode-ui-store";
import { useTourStore } from "@/lib/stores/tour-store";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/components/tour/cheat-sheet-modal", () => ({
  CheatSheetModal: () => null,
}));

import { TourReplayButton } from "./tour-replay-button";

describe("TourReplayButton Smart Mode collision", () => {
  beforeEach(() => {
    useTourStore.setState({ active: false });
    useSettingsStore.setState({ hideTourButton: false, tourButtonPosition: null });
    useSmartModeUIStore.setState({ open: false });
  });

  it("does not overlay the Smart Mode sheet and preserves Tour settings", () => {
    const { rerender } = render(<TourReplayButton />);
    expect(screen.getByRole("button", { name: "helpMenu" })).toBeInTheDocument();

    useSmartModeUIStore.setState({ open: true });
    rerender(<TourReplayButton />);
    expect(screen.queryByRole("button", { name: "helpMenu" })).not.toBeInTheDocument();
    expect(useSettingsStore.getState().hideTourButton).toBe(false);
    expect(useSettingsStore.getState().tourButtonPosition).toBeNull();
  });
});
