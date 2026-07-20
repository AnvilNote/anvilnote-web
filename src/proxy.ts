import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./lib/i18n/routing";
import { isDesktopOnlyRoute } from "./config/route-access";
import { isPublicWebRuntime } from "./config/runtime";

const intlMiddleware = createMiddleware(routing);

// Composes route-access policy with the existing next-intl locale routing.
// In desktop mode this is a pure pass-through — unchanged behavior. In
// public-web mode, desktop-only application routes (localized or not) are
// rejected here before locale detection/redirects run, so a guessed path
// never gets a locale-prefixed redirect toward a route that doesn't exist in
// this build. This is defense-in-depth, not the authoritative check — that's
// the (desktop) route-group layout guard, which still 404s even if a path is
// missing from DESKTOP_ONLY_ROUTE_PREFIXES here.
export default function proxy(request: NextRequest) {
  if (isPublicWebRuntime() && isDesktopOnlyRoute(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 });
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
