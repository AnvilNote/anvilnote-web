import type { ReactNode } from "react";
import "./globals.css";

// The locale segment owns the <html> document. This root layout is a
// required passthrough for the Next.js App Router.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
