"use client";

import { create } from "zustand";
import type { AnvilTemplate } from "@/types/template";
import { listTemplates } from "@/lib/api";
import { DEFAULT_TEMPLATE_ID } from "@/lib/templates/templates";

type TemplatesState = {
  templates: AnvilTemplate[];
  bySlug: Record<string, AnvilTemplate>;
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  getTemplate: (slug: string) => AnvilTemplate | undefined;
  defaultSlug: () => string;
};

export const useTemplatesStore = create<TemplatesState>()((set, get) => ({
  templates: [],
  bySlug: {},
  loaded: false,
  error: null,

  load: async () => {
    try {
      const templates = await listTemplates();
      const bySlug = Object.fromEntries(templates.map((t) => [t.id, t]));
      set({ templates, bySlug, loaded: true, error: null });
    } catch (error) {
      set({
        loaded: true,
        error: error instanceof Error ? error.message : "Failed to load templates",
      });
    }
  },

  getTemplate: (slug) => get().bySlug[slug],

  // Prefer the configured default; fall back to the first available template.
  defaultSlug: () => {
    const { bySlug, templates } = get();
    if (bySlug[DEFAULT_TEMPLATE_ID]) {
      return DEFAULT_TEMPLATE_ID;
    }
    return templates[0]?.id ?? DEFAULT_TEMPLATE_ID;
  },
}));
