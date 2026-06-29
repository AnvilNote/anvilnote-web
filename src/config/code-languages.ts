export type CodeLanguage = {
  label: string;
  value: string;
  aliases?: string[];
};

// Languages offered in the code-block selector. `value` is the canonical id
// stored in the Tiptap JSON (codeBlock.attrs.language) and emitted as the Typst
// raw-block tag. Keep this list in sync with the renderer's normalizer.
export const SUPPORTED_CODE_LANGUAGES: CodeLanguage[] = [
  { label: "Plain Text", value: "text", aliases: ["txt", "plain"] },
  { label: "Typst", value: "typ", aliases: ["typst"] },

  { label: "JavaScript", value: "javascript", aliases: ["js", "jsx"] },
  { label: "TypeScript", value: "typescript", aliases: ["ts"] },
  { label: "TSX", value: "tsx" },

  { label: "Python", value: "python", aliases: ["py"] },
  { label: "Rust", value: "rust", aliases: ["rs"] },
  { label: "Go", value: "go" },
  { label: "Java", value: "java" },
  { label: "C", value: "c" },
  { label: "C++", value: "cpp", aliases: ["c++", "cplusplus", "cc", "cxx"] },
  { label: "C#", value: "cs", aliases: ["csharp", "c#"] },
  { label: "PHP", value: "php" },
  { label: "Ruby", value: "ruby", aliases: ["rb"] },
  { label: "Swift", value: "swift" },
  { label: "Dart", value: "dart" },

  { label: "Bash", value: "bash", aliases: ["sh", "shell", "zsh"] },
  { label: "Fish", value: "fish" },

  { label: "HTML", value: "html", aliases: ["htm"] },
  { label: "CSS", value: "css" },
  { label: "SCSS", value: "scss" },
  { label: "Sass", value: "sass" },

  { label: "JSON", value: "json" },
  { label: "YAML", value: "yaml", aliases: ["yml"] },
  { label: "TOML", value: "toml" },
  { label: "XML", value: "xml" },
  { label: "SQL", value: "sql" },

  { label: "Markdown", value: "markdown", aliases: ["md"] },
  { label: "LaTeX", value: "latex", aliases: ["tex"] },
  { label: "Dockerfile", value: "dockerfile" },
  { label: "GraphQL", value: "graphql", aliases: ["gql"] },

  { label: "R", value: "r" },
  { label: "Julia", value: "julia", aliases: ["jl"] },
  { label: "MATLAB", value: "matlab" },
];

const aliasToValue = new Map<string, string>();

for (const language of SUPPORTED_CODE_LANGUAGES) {
  aliasToValue.set(language.value.toLowerCase(), language.value);

  for (const alias of language.aliases ?? []) {
    aliasToValue.set(alias.toLowerCase(), language.value);
  }
}

export function normalizeCodeLanguage(input?: string | null): string {
  if (!input) return "text";

  const key = input.trim().toLowerCase();

  if (!key) return "text";

  return aliasToValue.get(key) ?? "text";
}

export function getCodeLanguageLabel(value?: string | null): string {
  const normalized = normalizeCodeLanguage(value);
  return (
    SUPPORTED_CODE_LANGUAGES.find((language) => language.value === normalized)
      ?.label ?? "Plain Text"
  );
}
