"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { CommandMenu } from "@/components/app/command-menu";
import { TourOverlay } from "@/components/tour/tour-overlay";
import { TourReplayButton } from "@/components/tour/tour-replay-button";
import { useLastRouteStore } from "@/lib/stores/ui-store";

// Must match the fixed boot URL anvilnote-desktop/src/main/main.ts loads on
// launch — the only route we ever want to redirect away from below.
const DESKTOP_BOOT_ROUTE = "/documents";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const lastPath = useLastRouteStore((s) => s.path);
  const setLastPath = useLastRouteStore((s) => s.setPath);
  const hasCheckedBootRoute = useRef(false);

  // Track the current route so it can be restored on the desktop's next
  // cold boot. Skip the landing page: it isn't a real "last page" and the
  // desktop shell special-cases navigation away from it anyway.
  useEffect(() => {
    if (pathname === "/") return;
    setLastPath(pathname);
  }, [pathname, setLastPath]);

  // Desktop (unlike a browser tab) has no native "reopen where I left off":
  // it always cold-boots at DESKTOP_BOOT_ROUTE. Bounce to whatever route was
  // last recorded, exactly once per launch, and only on that boot route so a
  // deliberate later visit to it (e.g. via the sidebar) is never hijacked.
  useEffect(() => {
    if (hasCheckedBootRoute.current) return;
    hasCheckedBootRoute.current = true;
    if (typeof window === "undefined" || !window.anvilnote) return;
    if (pathname !== DESKTOP_BOOT_ROUTE) return;
    if (lastPath && lastPath !== DESKTOP_BOOT_ROUTE) {
      router.replace(lastPath);
    }
  }, [pathname, lastPath, router]);

  if (pathname === "/") {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider className="h-svh overflow-hidden">
        <AppSidebar />
        <SidebarInset className="min-h-0">
          <AppTopbar />
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {children}
          </main>
        </SidebarInset>
        <CommandMenu />
        <TourOverlay />
        <TourReplayButton />
      </SidebarProvider>
    </TooltipProvider>
  );
}
