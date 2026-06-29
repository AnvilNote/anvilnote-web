export type TemplateFieldType =
  | "text"
  | "textarea"
  | "date"
  | "boolean"
  | "select";

export type TemplateFieldScope = "metadata" | "option";

export type TemplateField = {
  key: string;
  label: string;
  type: TemplateFieldType;
  // Which bucket the value belongs to: document metadata (kept across
  // templates) or template options (bound to the current template).
  scope: TemplateFieldScope;
  required?: boolean;
  default?: string | boolean;
  placeholder?: string;
  options?: string[];
};

// `id` holds the template slug (= renderer folder name = Document.templateId).
export type AnvilTemplate = {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  fields: TemplateField[];
};
