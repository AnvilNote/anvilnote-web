import type { SettingsCategoryId } from "@/lib/stores/ui-store";

export type FeatureAvailability = "global" | "document" | "desktop";

export type FeatureReveal =
  | { kind: "settings"; category: SettingsCategoryId }
  | {
      kind: "right-panel";
      tab: "outline" | "metadata" | "template" | "export" | "history";
    }
  | { kind: "menu"; menuId: string }
  | { kind: "slash-menu" };

export type FeatureGuide = {
  targetId: string;
  reveal?: FeatureReveal;
};

export type ResolvedFeature = {
  id: string;
  label: string;
  description: string;
  path: string;
  keywords: string[];
  availability: FeatureAvailability;
  guide: FeatureGuide;
};

const KNOWN_REVEAL_ACTIONS = new Set<FeatureReveal["kind"]>([
  "settings",
  "right-panel",
  "menu",
  "slash-menu",
]);

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function fuzzyGapScore(target: string, query: string): number | null {
  let queryIndex = 0;
  let firstMatch = -1;
  let previousMatch = -1;
  let gaps = 0;

  for (
    let targetIndex = 0;
    targetIndex < target.length && queryIndex < query.length;
    targetIndex += 1
  ) {
    if (target[targetIndex] !== query[queryIndex]) continue;
    if (firstMatch < 0) firstMatch = targetIndex;
    if (previousMatch >= 0) gaps += targetIndex - previousMatch - 1;
    previousMatch = targetIndex;
    queryIndex += 1;
  }

  if (queryIndex !== query.length) return null;
  return Math.max(0, firstMatch) + gaps;
}

function fieldScore(
  value: string,
  query: string,
  base: {
    exact: number;
    prefix: number;
    includes: number;
    fuzzy: number;
  },
): number | null {
  const normalized = normalize(value);
  if (!normalized) return null;
  if (normalized === query) return base.exact;
  if (normalized.startsWith(query)) return base.prefix + normalized.length;

  const includesAt = normalized.indexOf(query);
  if (includesAt >= 0) return base.includes + includesAt;

  const fuzzy = fuzzyGapScore(normalized, query);
  return fuzzy === null ? null : base.fuzzy + fuzzy;
}

function scoreFeature(
  feature: ResolvedFeature,
  normalizedQuery: string,
): number | null {
  const scores = [
    fieldScore(feature.label, normalizedQuery, {
      exact: 0,
      prefix: 10,
      includes: 30,
      fuzzy: 70,
    }),
    ...feature.keywords.map((keyword) =>
      fieldScore(keyword, normalizedQuery, {
        exact: 20,
        prefix: 40,
        includes: 55,
        fuzzy: 85,
      }),
    ),
    fieldScore(feature.description, normalizedQuery, {
      exact: 60,
      prefix: 65,
      includes: 75,
      fuzzy: 100,
    }),
    fieldScore(feature.path, normalizedQuery, {
      exact: 80,
      prefix: 85,
      includes: 95,
      fuzzy: 120,
    }),
  ].filter((score): score is number => score !== null);

  return scores.length > 0 ? Math.min(...scores) : null;
}

export function searchFeatures(
  features: ResolvedFeature[],
  query: string,
  limit = 6,
): ResolvedFeature[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery || limit <= 0) return [];

  return features
    .map((feature, index) => ({
      feature,
      index,
      score: scoreFeature(feature, normalizedQuery),
    }))
    .filter(
      (
        result,
      ): result is {
        feature: ResolvedFeature;
        index: number;
        score: number;
      } => result.score !== null,
    )
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.feature.label.localeCompare(right.feature.label) ||
        left.index - right.index,
    )
    .slice(0, limit)
    .map(({ feature }) => feature);
}

export function validateFeatureCatalog(features: ResolvedFeature[]): void {
  const ids = new Set<string>();

  for (const feature of features) {
    if (ids.has(feature.id)) {
      throw new Error(`Duplicate feature ID: ${feature.id}`);
    }
    ids.add(feature.id);

    const reveal = feature.guide.reveal as
      | { kind?: string }
      | undefined;
    if (
      reveal?.kind &&
      !KNOWN_REVEAL_ACTIONS.has(reveal.kind as FeatureReveal["kind"])
    ) {
      throw new Error(`Unknown reveal action: ${reveal.kind}`);
    }
  }
}
