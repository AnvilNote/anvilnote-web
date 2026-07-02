// Auto-curated from package.json + `pnpm licenses list --prod` (web deps) and
// the renderer/desktop repos' own licenses (Typst, Electron). Regenerate by hand
// when dependencies change meaningfully — this is a credits page, not a build artifact.
export type AboutDependency = { name: string; license: string; url: string };

export const ABOUT_DEPENDENCIES: AboutDependency[] = [
  { name: "Next.js", license: "MIT", url: "https://nextjs.org" },
  { name: "React / React DOM", license: "MIT", url: "https://react.dev/" },
  { name: "Tiptap (@tiptap/*)", license: "MIT", url: "https://tiptap.dev" },
  { name: "Radix UI", license: "MIT", url: "https://radix-ui.com/primitives" },
  { name: "shadcn/ui", license: "MIT", url: "https://github.com/shadcn-ui/ui#readme" },
  { name: "Zustand", license: "MIT", url: "https://github.com/pmndrs/zustand" },
  { name: "next-intl", license: "MIT", url: "https://next-intl.dev" },
  { name: "next-themes", license: "MIT", url: "https://github.com/pacocoursey/next-themes#readme" },
  { name: "KaTeX", license: "MIT", url: "https://katex.org" },
  { name: "lowlight", license: "MIT", url: "https://github.com/wooorm/lowlight#readme" },
  { name: "lucide-react", license: "ISC", url: "https://lucide.dev" },
  { name: "pdfjs-dist", license: "Apache-2.0", url: "https://mozilla.github.io/pdf.js/" },
  { name: "react-pdf", license: "MIT", url: "https://github.com/wojtekmaj/react-pdf#readme" },
  { name: "react-resizable-panels", license: "MIT", url: "https://react-resizable-panels.vercel.app/" },
  { name: "cmdk", license: "MIT", url: "https://github.com/pacocoursey/cmdk#readme" },
  { name: "class-variance-authority", license: "Apache-2.0", url: "https://github.com/joe-bell/cva#readme" },
  { name: "clsx", license: "MIT", url: "https://github.com/lukeed/clsx#readme" },
  { name: "color", license: "MIT", url: "https://github.com/Qix-/color#readme" },
  { name: "jszip", license: "MIT / GPL-3.0-or-later", url: "https://github.com/Stuk/jszip#readme" },
  { name: "sonner", license: "MIT", url: "https://sonner.emilkowal.ski/" },
  { name: "tailwind-merge", license: "MIT", url: "https://github.com/dcastil/tailwind-merge" },
  { name: "uuid", license: "MIT", url: "https://github.com/uuidjs/uuid#readme" },
  { name: "Tailwind CSS", license: "MIT", url: "https://tailwindcss.com" },
  { name: "Typst", license: "Apache-2.0", url: "https://github.com/typst/typst" },
  { name: "Electron", license: "MIT", url: "https://www.electronjs.org/" },
  { name: "electron-builder", license: "MIT", url: "https://www.electron.build/" },
];

export type AboutFont = {
  family: string;
  license: string;
  licenseUrl: string;
  source: string;
  sourceUrl: string;
};

export const ABOUT_FONTS: AboutFont[] = [
  { family: "TW-MOE-Std-Kai", license: "CC BY-ND", licenseUrl: "https://creativecommons.org/licenses/by-nd/3.0/tw/", source: "MOE", sourceUrl: "https://language.moe.gov.tw/" },
  { family: "TW-MOE-Std-Song", license: "CC BY-ND", licenseUrl: "https://creativecommons.org/licenses/by-nd/3.0/tw/", source: "MOE", sourceUrl: "https://language.moe.gov.tw/" },
  { family: "思源黑體 TW", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Adobe Source Han Sans", sourceUrl: "https://github.com/adobe-fonts/source-han-sans" },
  { family: "TaiwanPearl", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "TaiwanPearl", sourceUrl: "https://github.com/max32002/TaiwanPearl" },
  { family: "Tinos", license: "Apache-2.0", licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/Tinos" },
  { family: "Noto Sans", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/Noto+Sans" },
  { family: "Noto Serif", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/Noto+Serif" },
  { family: "Roboto", license: "Apache-2.0", licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/Roboto" },
  { family: "Noto Serif JP", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/Noto+Serif+JP" },
  { family: "Noto Sans JP", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/Noto+Sans+JP" },
  { family: "Noto Serif KR", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/Noto+Serif+KR" },
  { family: "Noto Sans KR", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/Noto+Sans+KR" },
  { family: "Noto Serif Thai", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/Noto+Serif+Thai" },
  { family: "Noto Sans Thai", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/Noto+Sans+Thai" },
  { family: "JetBrains Mono", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "JetBrains", sourceUrl: "https://www.jetbrains.com/lp/mono/" },
  { family: "Noto Sans Mono", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/Noto+Sans+Mono" },
  { family: "New Computer Modern Math", license: "GUST Font License / OFL-compatible", licenseUrl: "https://www.gust.org.pl/projects/e-foundry/licenses", source: "New Computer Modern", sourceUrl: "https://www.gust.org.pl/projects/e-foundry/nfssfont.html" },
  { family: "EB Garamond", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/EB+Garamond" },
  { family: "Garamond-Math", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Garamond-Math", sourceUrl: "https://github.com/YuanshengZhao/Garamond-Math" },
  { family: "Playfair Display", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/Playfair+Display" },
  { family: "Tai Heritage Pro", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/Tai+Heritage+Pro" },
  { family: "Fira Sans", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/Fira+Sans" },
  { family: "Fira Code", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "tonsky/FiraCode", sourceUrl: "https://github.com/tonsky/FiraCode" },
  { family: "IBM Plex Mono", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/IBM+Plex+Mono" },
  { family: "TeX Gyre Pagella", license: "GUST Font License", licenseUrl: "https://www.gust.org.pl/projects/e-foundry/licenses", source: "GUST e-foundry (CTAN)", sourceUrl: "https://www.gust.org.pl/projects/e-foundry" },
  { family: "TeX Gyre Pagella Math", license: "GUST Font License", licenseUrl: "https://www.gust.org.pl/projects/e-foundry/licenses", source: "GUST e-foundry (CTAN)", sourceUrl: "https://www.gust.org.pl/projects/e-foundry" },
  { family: "Switzer", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Fontshare", sourceUrl: "https://www.fontshare.com/fonts/switzer" },
  { family: "Source Serif 4", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Adobe Source Serif", sourceUrl: "https://github.com/adobe-fonts/source-serif" },
  { family: "Source Sans 3", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Adobe Source Sans", sourceUrl: "https://github.com/adobe-fonts/source-sans" },
  { family: "Source Code Pro", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Adobe Source Code Pro", sourceUrl: "https://github.com/adobe-fonts/source-code-pro" },
  { family: "XITS", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "aliftype/xits", sourceUrl: "https://github.com/aliftype/xits" },
  { family: "XITS Math", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "aliftype/xits", sourceUrl: "https://github.com/aliftype/xits" },
  { family: "Barlow", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Google Fonts", sourceUrl: "https://fonts.google.com/specimen/Barlow" },
  { family: "New Computer Modern Sans", license: "GUST Font License / OFL-compatible", licenseUrl: "https://www.gust.org.pl/projects/e-foundry/licenses", source: "New Computer Modern", sourceUrl: "https://www.gust.org.pl/projects/e-foundry/nfssfont.html" },
  { family: "Source Sans Pro", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Adobe Source Sans (legacy pre-Source Sans 3 name)", sourceUrl: "https://github.com/adobe-fonts/source-sans-pro" },
  { family: "CMU Typewriter Text", license: "CM-Unicode custom license (permissive, unrestricted use)", licenseUrl: "https://sourceforge.net/projects/cm-unicode/", source: "CM-Unicode project (Andrey V. Panov)", sourceUrl: "https://sourceforge.net/projects/cm-unicode/" },
  { family: "cwTeX Q (Ming/Hei/Kai/Yuan/Fangsong)", license: "Arphic Public License", licenseUrl: "https://fedoraproject.org/wiki/Licensing:Arphic", source: "cwTeX / Arphic (AR PL fonts)", sourceUrl: "https://en.wikipedia.org/wiki/Arphic_Technology" },
  { family: "Liberation Serif", license: "OFL-1.1", licenseUrl: "https://scripts.sil.org/OFL", source: "Red Hat / liberationfonts", sourceUrl: "https://github.com/liberationfonts/liberation-fonts" },
];
