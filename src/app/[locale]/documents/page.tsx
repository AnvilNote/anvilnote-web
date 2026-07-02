"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { useDocumentStore } from "@/lib/stores/document-store";
import { useProjectStore } from "@/lib/stores/project-store";
import { useTemplatesStore } from "@/lib/stores/templates-store";
import { DocumentActions } from "@/components/app/document-actions";
import { ImportBackupButton } from "@/components/app/import-backup-button";
import { fuzzyMatch } from "@/lib/search/fuzzy";
import { documentPlainText } from "@/lib/search/document-text";

const PAGE_SIZE = 10;

// "all" = no project filter, "unfiled" = projectId === null, otherwise a
// literal project id.
type ProjectFilter = "all" | "unfiled" | string;

export default function DocumentsPage() {
  const t = useTranslations();
  const tt = useTranslations("templates");
  const format = useFormatter();
  const router = useRouter();

  const documents = useDocumentStore((s) => s.documents);
  const hydrated = useDocumentStore((s) => s.hydrated);
  const createDocument = useDocumentStore((s) => s.createDocument);
  const getTemplate = useTemplatesStore((s) => s.getTemplate);
  const projects = useProjectStore((s) => s.projects);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [page, setPage] = useState(1);

  const filteredDocuments = useMemo(() => {
    const filtered = documents.filter((doc) => {
      if (projectFilter === "unfiled" && doc.projectId !== null) return false;
      if (
        projectFilter !== "all" &&
        projectFilter !== "unfiled" &&
        doc.projectId !== projectFilter
      ) {
        return false;
      }
      if (!query.trim()) return true;
      const title = doc.title || t("documents.untitled");
      return fuzzyMatch(query, title) || fuzzyMatch(query, documentPlainText(doc.content));
    });
    return [...filtered].sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort === "newest" ? -diff : diff;
    });
  }, [documents, query, sort, projectFilter, t]);

  const pageCount = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedDocuments = filteredDocuments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  async function handleNew() {
    const doc = await createDocument(undefined, t("documents.defaultTitle"), {
      heading: t("documents.defaultHeading"),
      body: t("documents.defaultBody"),
    });
    router.push(`/documents/${doc.id}`);
    toast.success(t("toast.documentCreated"));
  }

  if (!hydrated) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-10">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("documents.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("documents.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportBackupButton />
          <Button onClick={() => void handleNew()} className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t("documents.newDocument")}</span>
          </Button>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        {t("documents.count", { count: filteredDocuments.length })}
      </p>

      {documents.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <p className="text-sm font-medium">{t("documents.empty")}</p>
          <p className="text-sm text-muted-foreground">
            {t("documents.emptyHint")}
          </p>
          <Button onClick={() => void handleNew()} variant="outline" className="gap-1.5">
            <Plus className="size-4" />
            {t("documents.newDocument")}
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            <div className="relative w-1/2">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={t("common.search")}
                className="rounded-none border-0 border-b pl-8 focus-visible:border-b-ring focus-visible:ring-0"
              />
            </div>
            <Select
              value={sort}
              onValueChange={(v) => {
                setSort(v as "newest" | "oldest");
                setPage(1);
              }}
            >
              <SelectTrigger className="ml-auto w-40 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t("common.sortNewest")}</SelectItem>
                <SelectItem value="oldest">{t("common.sortOldest")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={projectFilter}
              onValueChange={(v) => {
                setProjectFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("documents.filterAll")}</SelectItem>
                <SelectItem value="unfiled">{t("projects.unfiled")}</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredDocuments.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              {t("common.noResults")}
            </p>
          ) : (
            <ul className="mt-4 divide-y rounded-xl border">
              {pagedDocuments.map((doc) => {
                const template = getTemplate(doc.templateId);
                const templateName = template
                  ? tt.has(template.name as never)
                    ? tt(template.name as never)
                    : template.name
                  : doc.templateId;
                return (
                  <li
                    key={doc.id}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <Link
                      href={`/documents/${doc.id}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate text-sm font-medium">
                        {doc.title || t("documents.untitled")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {templateName} ·{" "}
                        {t("documents.lastEdited", {
                          date: format.dateTime(new Date(doc.updatedAt), {
                            dateStyle: "medium",
                            timeStyle: "medium",
                          }),
                        })}
                      </p>
                    </Link>
                    <div className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <DocumentActions doc={doc} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {pageCount > 1 ? (
            <Pagination className="mt-6">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                  <PaginationItem key={p}>
                    <PaginationLink
                      href="#"
                      isActive={p === currentPage}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(p);
                      }}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.min(pageCount, p + 1));
                    }}
                    className={currentPage === pageCount ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </>
      )}
    </div>
  );
}
