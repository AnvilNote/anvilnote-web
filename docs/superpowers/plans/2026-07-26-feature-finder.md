# Feature Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic full-site feature search to `⌘K` and guide users to the real control with an arrow.

**Architecture:** Keep catalog/search pure, coordinate reveal state through a focused Zustand store, and render target geometry in a standalone overlay. Existing UI components expose stable target IDs and open only the containers needed by the active guide.

**Tech Stack:** Next.js, React, TypeScript, Zustand, cmdk, next-intl, Vitest, Testing Library

## Global Constraints

- Search stays local and never calls AI.
- Show at most six feature results after a non-empty query.
- Do not execute the final feature action.
- Do not navigate or create a document when document context is missing.
- Use the exact approved Traditional Chinese empty and error copy.
- Feature targeting uses `data-feature-id`, never localized text or CSS classes.

---

### Task 1: Catalog and deterministic search

**Files:**
- Create: `src/lib/features/feature-catalog.ts`
- Create: `src/lib/features/feature-search.ts`
- Test: `src/lib/features/feature-search.test.ts`
- Modify: `messages/*.json`

**Interfaces:**
- Produces: `FeatureDefinition`, `ResolvedFeature`, `FEATURE_CATALOG`, `searchFeatures(features, query, limit)`

- [ ] **Step 1: Write failing ranking and validation tests**

```ts
expect(searchFeatures(features, "分頁", 6)[0]?.id).toBe("editor.pageBreak");
expect(searchFeatures(features, "換頁", 6)[0]?.id).toBe("editor.pageBreak");
expect(() => validateFeatureCatalog(duplicates)).toThrow(/duplicate/i);
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `pnpm exec vitest run src/lib/features/feature-search.test.ts`

- [ ] **Step 3: Implement catalog types, validation, normalization, scoring, and the initial full-site catalog**

```ts
export function searchFeatures(
  features: ResolvedFeature[],
  query: string,
  limit = 6,
): ResolvedFeature[] {
  return rankFeatureMatches(features, query).slice(0, limit);
}
```

- [ ] **Step 4: Add localized feature-finder copy and aliases**

- [ ] **Step 5: Run the test and commit**

Run: `pnpm exec vitest run src/lib/features/feature-search.test.ts`

### Task 2: Guide state and execution

**Files:**
- Create: `src/lib/stores/feature-guide-store.ts`
- Create: `src/lib/features/feature-guide.ts`
- Test: `src/lib/features/feature-guide.test.ts`

**Interfaces:**
- Consumes: `FeatureDefinition.guide`
- Produces: `useFeatureGuideStore`, `startFeatureGuide(feature, context)`, `dismissFeatureGuide()`

- [ ] **Step 1: Write failing guide-sequence tests**

```ts
expect(startFeatureGuide(documentFeature, { documentId: null })).toEqual({
  ok: false,
  reason: "document-required",
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `pnpm exec vitest run src/lib/features/feature-guide.test.ts`

- [ ] **Step 3: Implement availability checks, reveal requests, target waiting, replacement, and timeout**

- [ ] **Step 4: Run the tests and commit**

Run: `pnpm exec vitest run src/lib/features/feature-guide.test.ts`

### Task 3: Pointer overlay

**Files:**
- Create: `src/components/features/feature-pointer-overlay.tsx`
- Test: `src/components/features/feature-pointer-overlay.test.tsx`
- Modify: `src/components/app/app-shell.tsx`

**Interfaces:**
- Consumes: `useFeatureGuideStore().activeTarget`
- Produces: a five-second non-blocking arrow and pulse anchored to `data-feature-id`

- [ ] **Step 1: Write failing render, replacement, Escape, click, and timeout tests**

- [ ] **Step 2: Run tests and confirm they fail**

Run: `pnpm exec vitest run src/components/features/feature-pointer-overlay.test.tsx`

- [ ] **Step 3: Implement geometry tracking and dismissal**

```tsx
<div className="pointer-events-none fixed z-[70]" aria-live="polite">
  {t("featureFinder.here")}
</div>
```

- [ ] **Step 4: Mount the overlay in `AppShell`, run tests, and commit**

### Task 4: Command-menu integration

**Files:**
- Modify: `src/components/app/command-menu.tsx`
- Create: `src/components/app/command-menu-feature-search.test.tsx`

**Interfaces:**
- Consumes: `FEATURE_CATALOG`, `searchFeatures`, `startFeatureGuide`
- Produces: the localized Features result group and approved empty copy

- [ ] **Step 1: Write failing result, limit, empty-copy, and context tests**

- [ ] **Step 2: Run tests and confirm they fail**

Run: `pnpm exec vitest run src/components/app/command-menu-feature-search.test.tsx`

- [ ] **Step 3: Resolve localized catalog entries and render the Features group**

- [ ] **Step 4: Close `⌘K`, start the guide, and map availability failures to approved copy**

- [ ] **Step 5: Run tests and commit**

### Task 5: Reveal adapters and full-site targets

**Files:**
- Modify: `src/components/editor/tiptap-toolbar.tsx`
- Modify: `src/components/editor/page-break-menu.tsx`
- Modify: `src/components/editor/slash-command-menu.tsx`
- Modify: `src/components/editor/table-size-picker.tsx`
- Modify: `src/components/editor/question-kind-menu.tsx`
- Modify: `src/components/app/app-sidebar.tsx`
- Modify: `src/components/app/sidebar-projects.tsx`
- Modify: `src/components/app/app-topbar.tsx`
- Modify: `src/components/app/right-panel.tsx`
- Modify: `src/components/app/version-history-panel.tsx`
- Modify: `src/components/settings/settings-dialog.tsx`
- Modify: `src/components/export/export-panel.tsx`
- Modify: `src/components/templates/template-selector.tsx`
- Modify: `src/components/tour/tour-replay-button.tsx`
- Test: corresponding component tests

**Interfaces:**
- Consumes: active reveal requests from `useFeatureGuideStore`
- Produces: stable `data-feature-id` anchors and controlled menu/panel opening

- [ ] **Step 1: Write failing tests for page-break menu, right-panel tab, settings category, and slash-menu reveal**

- [ ] **Step 2: Run tests and confirm they fail**

- [ ] **Step 3: Add stable targets and reveal adapters without changing final action handlers**

- [ ] **Step 4: Run targeted tests, full tests, typecheck, lint, and catalog validation**

Run: `pnpm test && pnpm typecheck`

- [ ] **Step 5: Commit the complete feature**

```bash
git commit -m "feat: add feature finder"
```
