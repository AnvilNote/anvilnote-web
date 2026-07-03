"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type ChevronProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn("p-3", className)}
      classNames={{
        // `relative`: nav (absolute-positioned below) is `.month`'s SIBLING
        // here, not its descendant — both are direct children of
        // `.months`. Without `.months` itself establishing a positioning
        // context, nav's `absolute` escaped to whatever ancestor further
        // up the tree happens to be positioned (in a Popover, that's the
        // popover content box), landing nav's "top-0" against a
        // completely different top edge than `.month`'s — which is what
        // actually caused the chevrons to sit above the July/2026 line
        // instead of level with it, not a height/padding mismatch between
        // nav and the caption row (that part was already correct).
        months: "relative flex flex-col gap-4",
        month: "space-y-3",
        month_caption: "flex h-7 justify-center items-center relative",
        // Only rendered when captionLayout is "dropdown"/"dropdown-months"/
        // "dropdown-years": react-day-picker's Dropdown.tsx renders a real,
        // functional <select> plus a decorative aria-hidden sibling span
        // (reusing the caption_label class + a Chevron icon) meant for
        // custom label styling over a transparent select overlay. Kept
        // (not hidden) — its width is what makes dropdown_root hug the
        // actual selected text ("July", not the widest possible month
        // name), since the select itself is positioned absolute and so
        // doesn't contribute to dropdown_root's layout size. The visible
        // Chevron icon next to it is suppressed instead (see the Chevron
        // component below, orientation "down") — that's what read as an
        // unwanted "dropdown button" look; plain clickable text was the
        // actual ask, not the sizing mechanism itself.
        dropdowns: "flex items-center gap-1",
        dropdown_root: "relative inline-flex items-center",
        caption_label: "text-sm font-medium",
        // The real, functional element — invisible and positioned exactly
        // over the visible label span above, so no native <select> chrome
        // (border, background, focus ring) ever paints, in any state
        // including after picking an option.
        dropdown: "absolute inset-0 opacity-0 cursor-pointer outline-none",
        // z-10: nav and month_caption are both positioned elements with an
        // otherwise-auto z-index, so stacking falls back to DOM order —
        // month_caption happens to paint after nav and, despite only its
        // centered label having visible content, its own box still spans
        // the full row width and was silently absorbing every click on the
        // chevron buttons underneath it. An explicit z-index wins over
        // "auto" regardless of DOM order, so this reliably keeps nav on
        // top instead of depending on markup order that could shift with a
        // library update.
        nav: "z-10 flex h-7 items-center justify-between absolute inset-x-1 top-0",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-muted-foreground hover:text-foreground",
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-muted-foreground hover:text-foreground",
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-muted-foreground w-8 font-normal text-[0.8rem] text-center",
        week: "flex w-full mt-1",
        day: "size-8 text-center text-sm p-0 relative [&:has([aria-selected])]:rounded-md",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal aria-selected:opacity-100",
        ),
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        // orientation="left"/"right" are the prev/next nav buttons. "down"
        // is what Dropdown.tsx renders next to each month/year dropdown's
        // decorative label — suppressed (null) so the dropdown reads as
        // plain clickable text, not a fake select/button.
        Chevron: ({ orientation }: ChevronProps) => {
          if (orientation === "left") return <ChevronLeft className="size-4" />;
          if (orientation === "right") return <ChevronRight className="size-4" />;
          return <></>;
        },
      }}
      {...props}
    />
  )
}

export { Calendar }
