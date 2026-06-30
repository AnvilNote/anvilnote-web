"use client";

import { forwardRef, type AnchorHTMLAttributes } from "react";
import { useTransitionStore } from "@/lib/stores/transition-store";

type TransitionLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

/**
 * Anchor that plays the quill page transition before navigating.
 * `forwardRef` + prop spread keeps it usable as a Radix `asChild` slot
 * (e.g. inside `<Button asChild>`).
 */
export const TransitionLink = forwardRef<HTMLAnchorElement, TransitionLinkProps>(
  function TransitionLink({ href, onClick, ...props }, ref) {
    const start = useTransitionStore((s) => s.start);
    return (
      <a
        ref={ref}
        href={href}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          // Let modifier-clicks / new-tab behave normally.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
            return;
          }
          event.preventDefault();
          start(href);
        }}
        {...props}
      />
    );
  },
);
