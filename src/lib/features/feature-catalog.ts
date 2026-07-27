import type {
  FeatureAvailability,
  FeatureGuide,
  ResolvedFeature,
} from "./feature-search";

export type FeatureTranslator = ((key: string) => string) & {
  raw: (key: string) => unknown;
};

export type FeatureDefinition = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  pathKey: string;
  keywordKey?: string;
  availability: FeatureAvailability;
  guide: FeatureGuide;
};

const toolbarPath = "featureFinder.paths.editorToolbar";
const slashPath = "featureFinder.paths.editorSlash";
const sidebarPath = "featureFinder.paths.sidebar";
const panelPath = "featureFinder.paths.rightPanel";
const settingsPath = "featureFinder.paths.settings";

function toolbarFeature(
  id: string,
  labelKey: string,
  descriptionKey: string,
  guide: FeatureGuide = { targetId: id },
  keywordKey?: string,
): FeatureDefinition {
  return {
    id,
    labelKey,
    descriptionKey,
    pathKey: toolbarPath,
    keywordKey,
    availability: "document",
    guide,
  };
}

function settingsFeature(
  id: string,
  labelKey: string,
  descriptionKey: string,
  category:
    | "appearance"
    | "language"
    | "ai"
    | "documentDefaults"
    | "versionHistory"
    | "export"
    | "colorPalettes"
    | "backup"
    | "update",
  availability: FeatureAvailability = "global",
  keywordKey?: string,
): FeatureDefinition {
  return {
    id,
    labelKey,
    descriptionKey,
    pathKey: settingsPath,
    keywordKey,
    availability,
    guide: {
      targetId: id,
      reveal: { kind: "settings", category },
    },
  };
}

export const FEATURE_CATALOG: FeatureDefinition[] = [
  {
    id: "nav.documents",
    labelKey: "nav.documents",
    descriptionKey: "featureFinder.descriptions.openSection",
    pathKey: sidebarPath,
    keywordKey: "featureFinder.keywords.documents",
    availability: "global",
    guide: { targetId: "nav.documents" },
  },
  {
    id: "nav.projects",
    labelKey: "nav.projects",
    descriptionKey: "featureFinder.descriptions.openSection",
    pathKey: sidebarPath,
    keywordKey: "featureFinder.keywords.projects",
    availability: "global",
    guide: { targetId: "nav.projects" },
  },
  {
    id: "nav.templates",
    labelKey: "nav.templates",
    descriptionKey: "featureFinder.descriptions.openSection",
    pathKey: sidebarPath,
    keywordKey: "featureFinder.keywords.templates",
    availability: "global",
    guide: { targetId: "nav.templates" },
  },
  {
    id: "nav.settings",
    labelKey: "nav.settings",
    descriptionKey: "featureFinder.descriptions.openSection",
    pathKey: sidebarPath,
    keywordKey: "featureFinder.keywords.settings",
    availability: "global",
    guide: { targetId: "nav.settings" },
  },

  toolbarFeature(
    "editor.paragraph",
    "editor.toolbar.paragraph",
    "tour.itemHints.paragraph",
  ),
  toolbarFeature(
    "editor.heading1",
    "editor.toolbar.heading1",
    "tour.itemHints.heading1",
    {
      targetId: "editor.heading1",
      reveal: { kind: "menu", menuId: "editor.heading" },
    },
    "featureFinder.keywords.heading",
  ),
  toolbarFeature(
    "editor.heading2",
    "editor.toolbar.heading2",
    "tour.itemHints.heading2",
    {
      targetId: "editor.heading2",
      reveal: { kind: "menu", menuId: "editor.heading" },
    },
    "featureFinder.keywords.heading",
  ),
  toolbarFeature(
    "editor.heading3",
    "editor.toolbar.heading3",
    "tour.itemHints.heading3",
    {
      targetId: "editor.heading3",
      reveal: { kind: "menu", menuId: "editor.heading" },
    },
    "featureFinder.keywords.heading",
  ),
  toolbarFeature(
    "editor.bold",
    "editor.toolbar.bold",
    "tour.itemHints.bold",
    undefined,
    "featureFinder.keywords.bold",
  ),
  toolbarFeature(
    "editor.italic",
    "editor.toolbar.italic",
    "tour.itemHints.italic",
  ),
  toolbarFeature(
    "editor.footnote",
    "editor.toolbar.footnote",
    "tour.itemHints.footnote",
  ),
  toolbarFeature(
    "editor.strike",
    "editor.toolbar.strike",
    "tour.itemHints.strike",
  ),
  toolbarFeature(
    "editor.code",
    "editor.toolbar.code",
    "tour.itemHints.code",
  ),
  toolbarFeature(
    "editor.bulletList",
    "editor.toolbar.bulletList",
    "tour.itemHints.bulletList",
    undefined,
    "featureFinder.keywords.list",
  ),
  toolbarFeature(
    "editor.orderedList",
    "editor.toolbar.orderedList",
    "tour.itemHints.orderedList",
    undefined,
    "featureFinder.keywords.list",
  ),
  toolbarFeature(
    "editor.blockquote",
    "editor.toolbar.blockquote",
    "tour.itemHints.blockquote",
  ),
  toolbarFeature(
    "editor.callout",
    "editor.toolbar.callout",
    "tour.itemHints.callout",
  ),
  toolbarFeature(
    "editor.question",
    "editor.toolbar.questionBlock",
    "tour.itemHints.questionBlock",
    { targetId: "editor.question" },
    "featureFinder.keywords.question",
  ),
  toolbarFeature(
    "editor.mermaid",
    "editor.toolbar.mermaid",
    "tour.itemHints.mermaid",
  ),
  toolbarFeature(
    "editor.statsChart",
    "editor.toolbar.statsChart",
    "tour.itemHints.statsChart",
    undefined,
    "featureFinder.keywords.chart",
  ),
  toolbarFeature(
    "editor.codeBlock",
    "editor.toolbar.codeBlock",
    "tour.itemHints.codeBlock",
  ),
  toolbarFeature(
    "editor.table",
    "editor.toolbar.table",
    "tour.itemHints.table",
    { targetId: "editor.table" },
    "featureFinder.keywords.table",
  ),
  toolbarFeature(
    "editor.image",
    "editor.toolbar.image",
    "tour.itemHints.image",
    undefined,
    "featureFinder.keywords.image",
  ),
  toolbarFeature(
    "editor.pageBreak.forced",
    "editor.toolbar.pageBreakForced",
    "editor.toolbar.pageBreakForcedHint",
    {
      targetId: "editor.pageBreak.forced",
      reveal: { kind: "menu", menuId: "editor.pageBreak" },
    },
    "featureFinder.keywords.pageBreak",
  ),
  toolbarFeature(
    "editor.pageBreak.smart",
    "editor.toolbar.pageBreakWeak",
    "editor.toolbar.pageBreakWeakHint",
    {
      targetId: "editor.pageBreak.smart",
      reveal: { kind: "menu", menuId: "editor.pageBreak" },
    },
    "featureFinder.keywords.pageBreakSmart",
  ),
  toolbarFeature(
    "editor.inlineMath",
    "editor.toolbar.inlineMath",
    "tour.itemHints.inlineMath",
    {
      targetId: "editor.inlineMath",
      reveal: { kind: "menu", menuId: "editor.math" },
    },
    "featureFinder.keywords.math",
  ),
  toolbarFeature(
    "editor.blockMath",
    "editor.toolbar.blockMath",
    "tour.itemHints.blockMath",
    {
      targetId: "editor.blockMath",
      reveal: { kind: "menu", menuId: "editor.math" },
    },
    "featureFinder.keywords.math",
  ),
  toolbarFeature("editor.undo", "editor.toolbar.undo", "tour.itemHints.undo"),
  toolbarFeature("editor.redo", "editor.toolbar.redo", "tour.itemHints.redo"),
  toolbarFeature(
    "editor.smartMode",
    "ai.smart.title",
    "featureFinder.descriptions.ai",
    { targetId: "editor.smartMode" },
    "featureFinder.keywords.ai",
  ),

  {
    id: "editor.proof",
    labelKey: "editor.block.types.proof",
    descriptionKey: "featureFinder.descriptions.insertBlock",
    pathKey: slashPath,
    keywordKey: "featureFinder.keywords.proof",
    availability: "document",
    guide: {
      targetId: "editor.slash.proof",
      reveal: { kind: "slash-menu" },
    },
  },
  {
    id: "editor.divider",
    labelKey: "editor.block.types.divider",
    descriptionKey: "featureFinder.descriptions.insertBlock",
    pathKey: slashPath,
    keywordKey: "featureFinder.keywords.divider",
    availability: "document",
    guide: {
      targetId: "editor.slash.divider",
      reveal: { kind: "slash-menu" },
    },
  },

  ...(
    [
      ["outline", "tour.steps.panel.tabs.outline.body"],
      ["metadata", "tour.steps.panel.tabs.metadata.body"],
      ["template", "tour.steps.panel.tabs.template.body"],
      ["export", "tour.steps.panel.tabs.export.body"],
      ["history", "tour.steps.panel.tabs.history.body"],
    ] as const
  ).map(
    ([tab, descriptionKey]): FeatureDefinition => ({
      id: `panel.${tab}`,
      labelKey: `panel.${tab}`,
      descriptionKey,
      pathKey: panelPath,
      keywordKey:
        tab === "history"
          ? "featureFinder.keywords.history"
          : tab === "export"
            ? "featureFinder.keywords.export"
            : tab === "template"
              ? "featureFinder.keywords.templates"
              : undefined,
      availability: "document",
      guide: {
        targetId: `panel.${tab}`,
        reveal: { kind: "right-panel", tab },
      },
    }),
  ),
  {
    id: "panel.templatePreview",
    labelKey: "templates.previewTemplate",
    descriptionKey: "featureFinder.descriptions.openSection",
    pathKey: panelPath,
    keywordKey: "featureFinder.keywords.templatePreview",
    availability: "document",
    guide: {
      targetId: "panel.templatePreview",
      reveal: { kind: "right-panel", tab: "template" },
    },
  },

  settingsFeature(
    "settings.appearance",
    "settings.appearance.title",
    "settings.appearance.description",
    "appearance",
  ),
  settingsFeature(
    "settings.language",
    "settings.language.title",
    "settings.language.description",
    "language",
  ),
  settingsFeature(
    "settings.ai",
    "featureFinder.labels.aiSettings",
    "featureFinder.descriptions.ai",
    "ai",
    "global",
    "featureFinder.keywords.ai",
  ),
  settingsFeature(
    "settings.documentDefaults",
    "settings.documentDefaults.title",
    "settings.documentDefaults.description",
    "documentDefaults",
  ),
  settingsFeature(
    "settings.versionHistory",
    "settings.versionHistory.title",
    "settings.versionHistory.description",
    "versionHistory",
    "global",
    "featureFinder.keywords.history",
  ),
  settingsFeature(
    "settings.export",
    "settings.export.title",
    "settings.export.description",
    "export",
    "global",
    "featureFinder.keywords.export",
  ),
  settingsFeature(
    "settings.colorPalettes",
    "settings.colorPalettes.title",
    "settings.colorPalettes.description",
    "colorPalettes",
    "global",
    "featureFinder.keywords.palette",
  ),
  settingsFeature(
    "settings.backup",
    "settings.backup.title",
    "settings.backup.description",
    "backup",
    "global",
    "featureFinder.keywords.backup",
  ),
  settingsFeature(
    "settings.update",
    "settings.update.title",
    "settings.update.description",
    "update",
    "desktop",
    "featureFinder.keywords.update",
  ),
  {
    id: "help.tour",
    labelKey: "tour.helpMenu",
    descriptionKey: "featureFinder.descriptions.help",
    pathKey: "featureFinder.paths.help",
    keywordKey: "featureFinder.keywords.help",
    availability: "global",
    guide: { targetId: "help.tour" },
  },
];

export function resolveFeatureCatalog(
  t: FeatureTranslator,
): ResolvedFeature[] {
  return FEATURE_CATALOG.map((feature) => {
    const translatedKeywords = feature.keywordKey
      ? t.raw(feature.keywordKey)
      : [];
    const keywords = Array.isArray(translatedKeywords)
      ? translatedKeywords.filter(
          (keyword): keyword is string => typeof keyword === "string",
        )
      : [];

    return {
      id: feature.id,
      label: t(feature.labelKey),
      description: t(feature.descriptionKey),
      path: t(feature.pathKey),
      keywords: [...keywords, ...feature.id.split(/[._-]/u)],
      availability: feature.availability,
      guide: feature.guide,
    };
  });
}
