// Build-time runtime mode: which surface of AnvilNote a given build serves.
//
// `public-web` is the marketing/legal site — no document editor, no
// settings, nothing that touches real user data. `desktop` is the full
// application, built into the Electron shell (see anvilnote-desktop).
//
// This is a build mode baked in via NEXT_PUBLIC_ANVILNOTE_RUNTIME, not a
// runtime feature flag and not an authentication boundary — see
// docs/public-web-deployment.md for what this does and does not guarantee.

export const ANVILNOTE_RUNTIME_VALUES = ["public-web", "desktop"] as const;

export type AnvilNoteRuntime = (typeof ANVILNOTE_RUNTIME_VALUES)[number];

function isAnvilNoteRuntime(value: string): value is AnvilNoteRuntime {
  return (ANVILNOTE_RUNTIME_VALUES as readonly string[]).includes(value);
}

/**
 * Pure parser, unit-testable without touching process.env.
 *
 * - Valid value -> that value.
 * - Missing + development -> "desktop" (keeps `pnpm dev` working without
 *   requiring every contributor to set an env var for local work).
 * - Missing + any other NODE_ENV -> throws. A production-shaped build with no
 *   explicit runtime must fail loudly rather than silently ship the editor.
 * - Invalid value -> throws, in every environment.
 */
export function parseAnvilNoteRuntime(
  value: string | undefined,
  options?: { nodeEnv?: string },
): AnvilNoteRuntime {
  if (value === undefined || value === "") {
    const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV;
    if (nodeEnv === "development") return "desktop";
    throw new Error(
      "NEXT_PUBLIC_ANVILNOTE_RUNTIME is not set. Set it to \"public-web\" or " +
        "\"desktop\" before building or starting AnvilNote outside local development.",
    );
  }
  if (!isAnvilNoteRuntime(value)) {
    throw new Error(
      `NEXT_PUBLIC_ANVILNOTE_RUNTIME has an invalid value: "${value}". ` +
        `Expected one of: ${ANVILNOTE_RUNTIME_VALUES.join(", ")}.`,
    );
  }
  return value;
}

// process.env.NEXT_PUBLIC_ANVILNOTE_RUNTIME must appear as a static member
// expression (not a computed lookup) for Next.js to inline it at build time
// into client bundles — do not refactor this into a dynamic env[...] read.
export function getAnvilNoteRuntime(): AnvilNoteRuntime {
  return parseAnvilNoteRuntime(process.env.NEXT_PUBLIC_ANVILNOTE_RUNTIME);
}

export function isPublicWebRuntime(): boolean {
  return getAnvilNoteRuntime() === "public-web";
}

export function isDesktopRuntime(): boolean {
  return getAnvilNoteRuntime() === "desktop";
}
