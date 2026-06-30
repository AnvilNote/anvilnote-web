export type AnvilProject = {
  id: string;
  name: string;
  // Lucide icon name (e.g. "folder"); null falls back to a default icon.
  icon: string | null;
  createdAt: string;
  updatedAt: string;
};
