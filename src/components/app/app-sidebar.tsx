"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { FileText, LayoutTemplate, Plus, Search, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useUiStore } from "@/lib/stores/ui-store";
import { DocumentActions } from "@/components/app/document-actions";

export function AppSidebar() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  const createDocument = useDocumentStore((s) => s.createDocument);
  const documents = useDocumentStore((s) => s.documents);
  const setActive = useDocumentStore((s) => s.setActive);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);

  function closeMobile() {
    if (isMobile) setOpenMobile(false);
  }

  async function handleNewDocument() {
    const doc = await createDocument(undefined, t("documents.defaultTitle"));
    closeMobile();
    router.push(`/documents/${doc.id}`);
  }

  const navItems = [
    { href: "/documents", label: t("nav.documents"), icon: FileText },
    { href: "/templates", label: t("nav.templates"), icon: LayoutTemplate },
    { href: "/settings", label: t("nav.settings"), icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="gap-3 px-2 pt-3 group-data-[collapsible=icon]:px-0">
        <Link
          href="/documents"
          onClick={closeMobile}
          className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md">
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
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.documents")}</SidebarGroupLabel>
          <SidebarGroupAction
            aria-label={t("nav.newDocument")}
            title={t("nav.newDocument")}
            onClick={() => void handleNewDocument()}
            className="top-3 right-2 size-7 rounded-lg"
          >
            <Plus className="size-4.5" />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {documents.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                  {t("documents.empty")}
                </p>
              ) : (
                documents.map((doc) => {
                  const href = `/documents/${doc.id}`;
                  const active = pathname === href;
                  const title = doc.title || t("documents.untitled");
                  return (
                    <SidebarMenuItem key={doc.id} className="group/doc">
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={title}
                        className="pr-7"
                      >
                        <Link
                          href={href}
                          onClick={() => {
                            setActive(doc.id);
                            closeMobile();
                          }}
                        >
                          <FileText className="size-4 shrink-0" />
                          <span className="truncate">{title}</span>
                        </Link>
                      </SidebarMenuButton>
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-focus-within/doc:opacity-100 group-hover/doc:opacity-100 group-data-[collapsible=icon]:hidden">
                        <DocumentActions
                          doc={doc}
                          onDeleted={() => {
                            if (active) router.push("/documents");
                          }}
                        />
                      </div>
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("app.name")}</SidebarGroupLabel>
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
