"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const LIGHT_THEME_ICON = "/favicon-dark.svg";
const DARK_THEME_ICON = "/favicon-light.svg";

function upsertFavicon(rel: string, href: string) {
  let link = document.querySelector<HTMLLinkElement>(`link[rel='${rel}']`);

  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }

  link.href = href;
  link.type = "image/svg+xml";
}

export function ThemeFavicon() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const href = resolvedTheme === "dark" ? DARK_THEME_ICON : LIGHT_THEME_ICON;
    upsertFavicon("icon", href);
    upsertFavicon("shortcut icon", href);
  }, [resolvedTheme]);

  return null;
}
