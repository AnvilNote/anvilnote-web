"use client";

import { create } from "zustand";
import type { AnvilProject } from "@/types/project";
import {
  createProject as createProjectRequest,
  deleteProject as deleteProjectRequest,
  listProjects,
  updateProject as updateProjectRequest,
} from "@/lib/api";
import { useDocumentStore } from "@/lib/stores/document-store";

type ProjectState = {
  projects: AnvilProject[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  createProject: (name: string, icon: string | null) => Promise<AnvilProject>;
  updateProject: (
    id: string,
    patch: { name?: string; icon?: string | null },
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
};

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  hydrated: false,

  hydrate: async () => {
    try {
      const projects = await listProjects();
      set({ projects, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  createProject: async (name, icon) => {
    const project = await createProjectRequest({ name, icon });
    set((state) => ({ projects: [...state.projects, project] }));
    return project;
  },

  updateProject: async (id, patch) => {
    const updated = await updateProjectRequest(id, patch);
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? updated : p)),
    }));
  },

  deleteProject: async (id) => {
    await deleteProjectRequest(id);
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
    // The API unfiles the project's documents (SET NULL); mirror that locally.
    useDocumentStore.getState().unfileDocuments(id);
  },
}));
