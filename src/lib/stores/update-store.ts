import { create } from "zustand";
import { compareVersions, fetchLatestReleaseVersion } from "@/lib/update-check";

type UpdateState = {
  checked: boolean;
  latestVersion: string | null;
  checkForUpdate: () => Promise<void>;
};

export const useUpdateStore = create<UpdateState>((set, get) => ({
  checked: false,
  latestVersion: null,
  checkForUpdate: async () => {
    if (get().checked) return;
    set({ checked: true });
    const latestVersion = await fetchLatestReleaseVersion();
    set({ latestVersion });
  },
}));

export function selectHasUpdate(currentVersion: string) {
  return (state: UpdateState) =>
    state.latestVersion !== null &&
    compareVersions(state.latestVersion, currentVersion) > 0;
}
