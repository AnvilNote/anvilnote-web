"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  LucideIcon,
  PROJECT_ICON_NAMES,
  DEFAULT_PROJECT_ICON,
} from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";

// "BookOpen" → "book open" so a query can match either word.
function searchable(name: string): string {
  return name.replace(/([a-z])([A-Z0-9])/g, "$1 $2").toLowerCase();
}

// Simple subsequence fuzzy match: every char of `query` appears in order.
function fuzzyMatch(haystack: string, query: string): boolean {
  if (!query) return true;
  let i = 0;
  for (const ch of haystack) {
    if (ch === query[i]) i += 1;
    if (i === query.length) return true;
  }
  return i === query.length;
}

export function IconPicker({
  value,
  onChange,
  triggerClassName,
  iconClassName = "size-4.5",
}: {
  value: string | null;
  onChange: (name: string) => void;
  triggerClassName?: string;
  iconClassName?: string;
}) {
  const t = useTranslations("projects");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PROJECT_ICON_NAMES;
    return PROJECT_ICON_NAMES.filter(
      (name) => fuzzyMatch(name.toLowerCase(), q) || fuzzyMatch(searchable(name), q),
    );
  }, [query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("icon")}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-foreground transition-colors hover:bg-accent",
            triggerClassName,
          )}
        >
          <LucideIcon iconName={value ?? DEFAULT_PROJECT_ICON} className={iconClassName} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            autoFocus
            placeholder={t("iconSearch")}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-full rounded-md border border-input/40 bg-input/30 pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-input"
          />
        </div>
        {results.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">
            {t("iconEmpty")}
          </p>
        ) : (
          <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 224 }}>
            <div className="grid grid-cols-7 justify-items-center gap-1">
              {results.map((name) => (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md transition-colors hover:bg-accent",
                    value === name && "bg-accent text-accent-foreground",
                  )}
                >
                  <LucideIcon iconName={name} className="size-4.5" />
                </button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
