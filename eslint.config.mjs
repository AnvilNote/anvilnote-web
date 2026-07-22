import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // These components predate the React compiler rules bundled by Next 16.
  // Keep the exception scoped to the existing components while they are
  // refactored; new application code remains subject to the default rules.
  {
    files: [
      "src/components/app/app-topbar.tsx",
      "src/components/editor/block-handle.tsx",
      "src/components/editor/node-views/question-item-node-view.tsx",
      "src/components/editor/tiptap-editor.tsx",
      "src/components/editor/tiptap-toolbar.tsx",
      "src/components/onboarding/first-run-onboarding.tsx",
      "src/components/tour/tour-overlay.tsx",
      "src/components/transition/holiday-shower.tsx",
      "src/components/ui/color-picker.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
