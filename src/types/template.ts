export type TemplateFieldType = "text" | "date" | "select" | "boolean";

export type TemplateField = {
  key: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
  placeholder?: string;
  defaultValue?: string | boolean | null;
  options?: string[];
};

export type TemplateCategory = "note" | "lecture" | "academic" | "teaching";

export type AnvilTemplate = {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  fields: TemplateField[];
};
