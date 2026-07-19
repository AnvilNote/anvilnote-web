import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // These pre-existing suites intentionally use Node's built-in test
    // runner. Vitest loading them would execute the tests and then report
    // "no suite" because their registrations belong to node:test.
    exclude: ["src/lib/tiptap/table-*.test.ts"],
    clearMocks: true,
  },
});
