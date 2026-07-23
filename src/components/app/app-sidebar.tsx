"use client";

import type { MouseEvent } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { FileText, FolderKanban, Info, LayoutTemplate, Search, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link } from "@/lib/i18n/navigation";
import { useSettingsDialogStore, useUiStore } from "@/lib/stores/ui-store";
import { useTransitionStore } from "@/lib/stores/transition-store";
import { SidebarProjects } from "@/components/app/sidebar-projects";
import { AppVersion } from "@/components/app/app-version";
import { getActiveHoliday } from "@/lib/holidays";

export function AppSidebar() {
  const t = useTranslations();
  const { setOpenMobile, isMobile } = useSidebar();
  const holiday = getActiveHoliday();

  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const openSettings = useSettingsDialogStore((s) => s.openSettings);
  const startTransition = useTransitionStore((s) => s.start);

  function closeMobile() {
    if (isMobile) setOpenMobile(false);
  }

  // Logo returns to the landing page with the quill transition. In the desktop
  // app there's no landing to return to, so we cancel and stay put instead.
  function handleLogoClick(event: MouseEvent) {
    event.preventDefault();
    closeMobile();
    if (typeof window !== "undefined" && window.anvilnote) return;
    startTransition("/");
  }

  const navItems = [
    { href: "/projects", label: t("nav.projects"), icon: FolderKanban },
    { href: "/documents", label: t("nav.documents"), icon: FileText },
    { href: "/templates", label: t("nav.templates"), icon: LayoutTemplate },
    { href: "/about", label: t("nav.about"), icon: Info },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="gap-3 px-2 pt-3 group-data-[collapsible=icon]:px-0">
        <Link
          href="/"
          onClick={handleLogoClick}
          className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md">
            {holiday ? (
              <holiday.hat.Icon
                aria-hidden="true"
                className="absolute -top-1.5 -right-1 size-3.5"
                style={{ transform: `rotate(${holiday.hat.deg}deg)` }}
              />
            ) : null}
            <Image
              src="/favicon-dark.svg"
              alt=""
              aria-hidden="true"
              width={28}
              height={28}
              className="size-7 dark:hidden"
            />
            <Image
              src="/favicon-light.svg"
              alt=""
              aria-hidden="true"
              width={28}
              height={28}
              className="hidden size-7 dark:block"
            />
          </span>
          <span className="text-[15px] font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            {t("app.name")}
          </span>
        </Link>

        <SidebarMenu className="gap-1.5 group-data-[collapsible=icon]:px-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={t("nav.search")}
              onClick={() => {
                closeMobile();
                setCommandOpen(true);
              }}
              className="border bg-background text-muted-foreground hover:text-foreground"
            >
              <Search className="size-4" />
              <span className="flex-1 text-left">{t("nav.search")}</span>
              <kbd className="pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
                ⌘K
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-1 group-data-[collapsible=icon]:px-0">
        <SidebarProjects />
      </SidebarContent>

      <SidebarFooter>
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.label}
                  >
                    <Link href={item.href} onClick={closeMobile}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={t("nav.settings")}
                  onClick={() => {
                    closeMobile();
                    openSettings();
                  }}
                >
                  <Settings className="size-4" />
                  <span>{t("nav.settings")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <AppVersion />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
