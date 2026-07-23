import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// A small bold label used to group a few rows under one heading within a
// settings category (e.g. "Key management", "Advanced") — text only, no
// box, so grouped rows don't turn into another card nested inside the
// category's own panel.
export function SettingsSubheading({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium">{children}</p>;
}

export function SettingsRow({
  id,
  label,
  hint,
  control,
  highlighted,
}: {
  // Search target: settings-dialog's fuzzy search scrolls to and briefly
  // highlights the row with this id after navigating to it.
  id?: string;
  label: string;
  hint?: string;
  control: ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div
      id={id}
      className="flex scroll-mt-4 items-center justify-between gap-4 border-b py-3 first:pt-0 last:border-b-0"
    >
      <div className="space-y-0.5">
        <p
          className={cn(
            "text-sm font-medium transition-colors",
            highlighted && "underline decoration-wavy decoration-2 underline-offset-4",
          )}
          style={highlighted ? { textDecorationColor: "#939bc9" } : undefined}
        >
          {label}
        </p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
