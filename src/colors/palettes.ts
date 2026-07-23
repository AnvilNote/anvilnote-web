// Named categorical color palettes offered by the chart color-palette picker
// (stats-chart-dialog.tsx) — a one-click alternative to hand-picking each
// bar/series color, since the picker's own single fixed DEFAULT_COLOR_CYCLE
// (stats-chart-defaults.ts) isn't the only reasonable look for every chart.
// Each is a well-known, previously-published set (not invented here), kept
// as plain hex strings — sourced from:
//   - Tableau 10: Tableau's own default categorical palette.
//   - D3 Category 10: d3-scale-chromatic's schemeCategory10 (also Vega/
//     Observable's long-standing default).
//   - Okabe–Ito: Okabe & Ito's 2008 colorblind-safe 8-color set, the
//     standard recommendation for accessible qualitative data viz.
//   - ColorBrewer Set2 / Dark2: Cynthia Brewer's ColorBrewer qualitative
//     schemes, both flagged colorblind-safe on colorbrewer2.org.
export type ColorPaletteId =
  | "tableau10"
  | "d3Category10"
  | "okabeIto"
  | "colorBrewerSet2"
  | "colorBrewerDark2";

export type ColorPalette = {
  id: ColorPaletteId;
  colors: string[];
};

export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: "tableau10",
    colors: [
      "#4E79A7",
      "#F28E2B",
      "#E15759",
      "#76B7B2",
      "#59A14F",
      "#EDC948",
      "#B07AA1",
      "#FF9DA7",
      "#9C755F",
      "#BAB0AC",
    ],
  },
  {
    id: "d3Category10",
    colors: [
      "#1F77B4",
      "#FF7F0E",
      "#2CA02C",
      "#D62728",
      "#9467BD",
      "#8C564B",
      "#E377C2",
      "#7F7F7F",
      "#BCBD22",
      "#17BECF",
    ],
  },
  {
    id: "okabeIto",
    colors: [
      "#E69F00",
      "#56B4E9",
      "#009E73",
      "#F0E442",
      "#0072B2",
      "#D55E00",
      "#CC79A7",
      "#000000",
    ],
  },
  {
    id: "colorBrewerSet2",
    colors: [
      "#66C2A5",
      "#FC8D62",
      "#8DA0CB",
      "#E78AC3",
      "#A6D854",
      "#FFD92F",
      "#E5C494",
      "#B3B3B3",
    ],
  },
  {
    id: "colorBrewerDark2",
    colors: [
      "#1B9E77",
      "#D95F02",
      "#7570B3",
      "#E7298A",
      "#66A61E",
      "#E6AB02",
      "#A6761D",
      "#666666",
    ],
  },
];

export function getColorPalette(id: ColorPaletteId): ColorPalette | undefined {
  return COLOR_PALETTES.find((palette) => palette.id === id);
}

export function colorFromPalette(id: ColorPaletteId, index: number): string {
  const palette = getColorPalette(id);
  if (!palette || palette.colors.length === 0) return "#000000";
  return palette.colors[index % palette.colors.length];
}
