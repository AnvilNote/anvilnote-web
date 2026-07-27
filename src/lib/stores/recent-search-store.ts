"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { addRecentSearch } from "@/lib/search/recent-searches";

type RecentSearchState = {
  searches: string[];
  addSearch: (query: string) => void;
};

export const useRecentSearchStore = create<RecentSearchState>()(
  persist(
    (set) => ({
      searches: [],
      addSearch: (query) =>
        set((state) => ({
          searches: addRecentSearch(state.searches, query),
        })),
    }),
    {
      name: "anvilnote.recent-searches",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
