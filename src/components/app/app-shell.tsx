"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/lib/i18n/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { CommandMenu } from "@/components/app/command-menu";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

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
      </SidebarProvider>
    </TooltipProvider>
  );
}
