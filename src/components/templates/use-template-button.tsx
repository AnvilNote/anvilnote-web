"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Collapsed to a plain circle by default; on hover it grows into a labeled
// pill (bg-foreground/text-background — black-on-white in light mode,
// white-on-black in dark mode, matching the landing page's inverted button).
export function UseTemplateButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "group/use flex h-10 w-10 shrink-0 items-center justify-center gap-0 overflow-hidden rounded-full bg-foreground px-0 text-background transition-all duration-200 ease-out hover:w-auto hover:gap-2 hover:px-4",
        className,
      )}
    >
      <ArrowRight className="size-4 shrink-0" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-200 ease-out group-hover/use:max-w-40 group-hover/use:opacity-100">
        {label}
      </span>
    </button>
  );
}
