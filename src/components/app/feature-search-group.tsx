"use client";

import { SearchX, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import {
  searchFeatures,
  type ResolvedFeature,
} from "@/lib/features/feature-search";

type FeatureSearchGroupProps = {
  query: string;
  features: ResolvedFeature[];
  onSelect: (feature: ResolvedFeature) => void;
};

export function FeatureSearchGroup({
  query,
  features,
  onSelect,
}: FeatureSearchGroupProps) {
  const t = useTranslations("featureFinder");
  const normalizedQuery = query.trim();

  if (!normalizedQuery) return null;

  const results = searchFeatures(features, normalizedQuery, 6);

  return (
    <CommandGroup heading={t("group")} forceMount>
      {results.length > 0 ? (
        results.map((feature) => (
          <CommandItem
            key={feature.id}
            value={[
              feature.label,
              feature.description,
              feature.path,
              ...feature.keywords,
            ].join(" ")}
            forceMount
            onSelect={() => onSelect(feature)}
            className="items-start py-2.5"
          >
            <Sparkles className="mt-0.5 size-4 text-[#939bc9]" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{feature.label}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">
                {feature.description}
              </span>
            </span>
            <span className="ml-3 max-w-40 shrink-0 truncate pt-0.5 text-xs text-muted-foreground">
              {feature.path}
            </span>
          </CommandItem>
        ))
      ) : (
        <CommandItem
          value={`${normalizedQuery} feature-empty`}
          forceMount
          disabled
          className="py-3 text-muted-foreground opacity-100!"
        >
          <SearchX className="size-4" />
          <span>{t("noMatch")}</span>
        </CommandItem>
      )}
    </CommandGroup>
  );
}
