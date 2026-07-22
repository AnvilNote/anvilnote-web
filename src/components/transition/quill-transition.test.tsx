import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTransitionStore } from "@/lib/stores/transition-store";
import { useSettingsStore } from "@/lib/stores/settings-store";

vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/holidays", () => ({
  getActiveHoliday: () => ({
    id: "test-holiday",
    icons: [() => null],
    hat: { Icon: () => null, deg: 0 },
  }),
}));

import { QuillTransition } from "./quill-transition";

describe("QuillTransition holiday shower toggle", () => {
  beforeEach(() => {
    useTransitionStore.setState({ playing: false, to: null });
    useSettingsStore.setState({ holidayEffectsEnabled: true });
  });

  it("shows the holiday shower while playing when the setting is enabled", () => {
    useTransitionStore.setState({ playing: true, to: null });
    const { container } = render(<QuillTransition />);
    expect(container.querySelector(".holiday-shower")).not.toBeNull();
  });

  it("hides the holiday shower when the person disabled it in settings", () => {
    useSettingsStore.setState({ holidayEffectsEnabled: false });
    useTransitionStore.setState({ playing: true, to: null });
    const { container } = render(<QuillTransition />);
    expect(container.querySelector(".holiday-shower")).toBeNull();
  });
});
