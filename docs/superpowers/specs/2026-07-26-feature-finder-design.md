# Feature Finder Design

## Goal

Let users search AnvilNote's full feature set from the existing `⌘K`
command menu, then reveal the feature's real UI location without executing
the final action for them.

## Product behavior

- Feature search is local, offline, deterministic, and does not call AI.
- Results appear in a new **Features** group after the user types a query.
- Each result shows a localized name, description, and location path.
- Search ranks exact names, prefixes, aliases, fuzzy names, then descriptions.
- At most six feature results are shown.
- Selecting a result closes `⌘K`, reveals any required panel or menu, scrolls
  the final target into view, and points to it with a lightweight arrow and
  pulse.
- The final control remains unactivated; the user performs the action.
- A new guide replaces any guide already on screen. Guides disappear after
  five seconds, on `Escape`, or when the target is clicked.
- A feature that requires an open document never navigates or creates one.
  It reports `請先開啟文件後使用此功能。`
- A feature unavailable on Web reports `此功能僅支援桌面版。`
- When no feature matches, the Features group reports
  `找不到想要的功能？換其他關鍵字試試？`
- If a registered target cannot be revealed, report
  `暫時無法顯示功能位置，請稍後再試。`

## Architecture

### Feature catalog

`FeatureCatalog` is pure data. Each feature has a stable ID, localized copy
keys, aliases, availability, and a declarative guide:

```ts
type FeatureDefinition = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  pathKey: string;
  keywordKey: string;
  availability: "global" | "document" | "desktop";
  guide: FeatureGuide;
};
```

The first catalog covers editor controls and menus, slash-only features,
sidebar navigation, right-panel tabs, settings categories, templates,
import/export, backup, update, and help.

### Search

`FeatureSearch` accepts resolved localized strings and returns deterministic
scores. It has no React or DOM dependency and is unit-tested independently.
The existing command palette renders its results alongside documents and
commands.

### Guide engine

`FeatureGuideEngine` executes declarative reveal steps through UI stores:

- open a settings category;
- switch a right-panel tab;
- open a registered popover or slash menu;
- find a stable `[data-feature-id]` target;
- scroll and request the pointer overlay.

Interactive containers observe only guide requests relevant to their IDs.
The catalog does not import component implementations.

### Pointer overlay

`FeaturePointerOverlay` renders in `AppShell`. It measures the final target,
draws a non-blocking arrow and pulse, follows resize/scroll, and never dims the
whole page. Targets remain clickable.

## Stable targeting

Discoverable controls receive `data-feature-id`. IDs are independent of
localized copy and CSS classes. Menus are controlled only while their feature
is being revealed and return to normal user-controlled behavior afterward.

## Validation

- Catalog validation rejects duplicate IDs, missing copy, unknown guide
  actions, and inconsistent availability.
- Search tests cover exact, alias, fuzzy, description, locale, limit, and
  zero-result behavior.
- Guide tests cover context failures, reveal order, target timeout, replacement,
  and dismissal.
- Command-menu tests cover the Features group and required copy.
- Component tests cover controlled menu opening and stable target IDs.
