export type AnvilMetadataValue = string | boolean | null;

export type AnvilDocument = {
  id: string;
  title: string;
  icon?: string;
  blocks: unknown[];
  templateId: string;
  metadata: Record<string, AnvilMetadataValue>;
  createdAt: string;
  updatedAt: string;
};
