import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isPublicWebRuntime } from "@/config/runtime";

// Authoritative server-side gate for every real-application route (documents,
// templates, settings, about, projects). The public-web build must never
// render these — checked before any editor state, store, or client code
// loads, so there is no client-side flash and no reliance on useEffect.
export default function DesktopLayout({ children }: { children: ReactNode }) {
  if (isPublicWebRuntime()) {
    notFound();
  }

  return children;
}
