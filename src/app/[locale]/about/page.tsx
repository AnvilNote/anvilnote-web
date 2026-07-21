"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppVersion } from "@/components/app/app-version";
import { ABOUT_DEPENDENCIES, ABOUT_FONTS } from "@/lib/about/about-data";

type LicenseRow = { name: string; license: string; licenseUrl: string; source: string; sourceUrl: string };

function LicenseCell({ row }: { row: LicenseRow }) {
  return (
    <>
      <td className="px-4 py-2 font-medium">{row.name}</td>
      <td className="px-4 py-2">
        {row.licenseUrl ? (
          <a
            href={row.licenseUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            {row.license}
          </a>
        ) : (
          row.license
        )}
      </td>
      <td className="px-4 py-2">
        {row.sourceUrl ? (
          <a
            href={row.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            {row.source}
          </a>
        ) : (
          row.source
        )}
      </td>
    </>
  );
}

// One table, six columns: the list is split in half and each table row holds
// one entry from the left half and one from the right half side by side, so
// a long credits list reads as two columns instead of one long scroll.
function LicenseTable({
  rows,
  nameHeader,
  licenseHeader,
  sourceHeader,
}: {
  rows: LicenseRow[];
  nameHeader: string;
  licenseHeader: string;
  sourceHeader: string;
}) {
  const mid = Math.ceil(rows.length / 2);
  const left = rows.slice(0, mid);
  const right = rows.slice(mid);

  return (
    <div>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">{nameHeader}</th>
            <th className="px-4 py-2 font-medium">{licenseHeader}</th>
            <th className="px-4 py-2 font-medium">{sourceHeader}</th>
            <th className="px-4 py-2 font-medium">{nameHeader}</th>
            <th className="px-4 py-2 font-medium">{licenseHeader}</th>
            <th className="px-4 py-2 font-medium">{sourceHeader}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {left.map((row, i) => {
            const pair = right[i];
            return (
              <tr key={row.name}>
                <LicenseCell row={row} />
                {pair ? (
                  <>
                    <td className="px-4 py-2 font-medium">{pair.name}</td>
                    <LicenseCellRest row={pair} />
                  </>
                ) : (
                  <td className="px-4 py-2" colSpan={3} />
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Same as the license/source half of LicenseCell, without the name cell —
// the right-hand pair's name cell is rendered separately in LicenseTable.
function LicenseCellRest({ row }: { row: LicenseRow }) {
  return (
    <>
      <td className="px-4 py-2">
        {row.licenseUrl ? (
          <a
            href={row.licenseUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            {row.license}
          </a>
        ) : (
          row.license
        )}
      </td>
      <td className="px-4 py-2">
        {row.sourceUrl ? (
          <a
            href={row.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            {row.source}
          </a>
        ) : (
          row.source
        )}
      </td>
    </>
  );
}

export default function AboutPage() {
  const t = useTranslations("about");
  const version = useAppVersion();

  const fontRows = ABOUT_FONTS.map((f) => ({
    name: f.family,
    license: f.license,
    licenseUrl: f.licenseUrl,
    source: f.source,
    sourceUrl: f.sourceUrl,
  }));

  const dependencyRows = ABOUT_DEPENDENCIES.map((d) => ({
    name: d.name,
    license: d.license,
    licenseUrl: "",
    source: t("dependenciesTab.projectLink"),
    sourceUrl: d.url,
  }));

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10 sm:px-10">
      <Tabs defaultValue="about">
        <TabsList>
          <TabsTrigger value="about">{t("tabs.about")}</TabsTrigger>
          <TabsTrigger value="fonts">{t("tabs.fonts")}</TabsTrigger>
          <TabsTrigger value="dependencies">{t("tabs.dependencies")}</TabsTrigger>
        </TabsList>

        <TabsContent value="about" className="mt-6">
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-background shadow-sm">
              <Image
                src="/favicon-dark.svg"
                alt=""
                aria-hidden="true"
                width={64}
                height={64}
                className="size-16 dark:hidden"
              />
              <Image
                src="/favicon-light.svg"
                alt=""
                aria-hidden="true"
                width={64}
                height={64}
                className="hidden size-16 dark:block"
              />
            </span>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">{t("appName")}</h1>
              <p className="text-sm text-muted-foreground">{t("version", { version })}</p>
            </div>
            <p className="max-w-md whitespace-pre-line text-sm text-muted-foreground">
              {t("description")}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="fonts" className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">{t("fontsTab.hint")}</p>
          <LicenseTable
            rows={fontRows}
            nameHeader={t("fontsTab.family")}
            licenseHeader={t("fontsTab.license")}
            sourceHeader={t("fontsTab.source")}
          />
        </TabsContent>

        <TabsContent value="dependencies" className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">{t("dependenciesTab.hint")}</p>
          <LicenseTable
            rows={dependencyRows}
            nameHeader={t("dependenciesTab.name")}
            licenseHeader={t("dependenciesTab.license")}
            sourceHeader={t("dependenciesTab.source")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
