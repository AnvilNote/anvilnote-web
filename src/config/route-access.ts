// Route-level policy for which paths exist in the public-web build.
//
// This is product-surface separation, not authentication — see
// docs/public-web-deployment.md. The authoritative enforcement point is the
// (desktop) route-group layout guard (src/app/[locale]/(desktop)/layout.tsx),
// which calls notFound() server-side. This module additionally lets the
// proxy short-circuit desktop-only requests before they reach routing, and
// is covered by its own unit tests since the exact prefix list matters.

import { locales } from "@/lib/i18n/routing";

// Routes that exist in every build and are always reachable in public-web
// mode. "/" (the locale root) is intentionally not listed here — it is
// treated as public by isPublicWebRoute's fallback, since every locale-only
// path (e.g. "/en") is the landing page.
export const PUBLIC_WEB_ROUTE_PREFIXES: readonly string[] = [
  "/privacy",
  "/terms",
];

// Real-application routes. These must never be reachable in public-web mode,
// enforced both here (proxy, best-effort/defense-in-depth) and in the
// (desktop) layout guard (authoritative).
export const DESKTOP_ONLY_ROUTE_PREFIXES: readonly string[] = [
  "/documents",
  "/templates",
  "/settings",
  "/projects",
  "/about",
];

const LOCALE_PREFIX_PATTERN = new RegExp(`^/(?:${locales.join("|")})(?=/|$)`);

/** Strips a leading "/en", "/zh-TW", etc. prefix, if present. "" stays "". */
export function stripLocalePrefix(pathname: string): string {
  const stripped = pathname.replace(LOCALE_PREFIX_PATTERN, "");
  return stripped === "" ? "/" : stripped;
}

function pathStartsWithPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isDesktopOnlyRoute(pathname: string): boolean {
  const path = stripLocalePrefix(pathname);
  return DESKTOP_ONLY_ROUTE_PREFIXES.some((prefix) => pathStartsWithPrefix(path, prefix));
}

export function isPublicWebRoute(pathname: string): boolean {
  const path = stripLocalePrefix(pathname);
  if (path === "/") return true;
  return PUBLIC_WEB_ROUTE_PREFIXES.some((prefix) => pathStartsWithPrefix(path, prefix));
}
