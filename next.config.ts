import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Standalone output so the desktop shell can run the app as a self-contained
  // localhost server sidecar (.next/standalone/server.js) under Electron's Node
  // runtime — no system Node, and no static-export rewrite of routing/i18n.
  output: "standalone",
};

export default withNextIntl(nextConfig);
