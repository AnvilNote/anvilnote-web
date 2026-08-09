import { describe, expect, it } from "vitest";
import { buildRequestBody, defaultDraft, draftFromRequestBody, type ChartRequestBody } from "./chart-spec";

describe("defaultDraft", () => {
  it("seeds 5 empty rows shaped for the chart's own row shape", () => {
    const draft = defaultDraft("scatter");
    expect(draft.data).toHaveLength(5);
    // Every column, including numeric ones, defaults to "" — matching
    // numeric-input.ts's codebase-wide "empty means the string '', not 0"
    // convention (see row-shapes.ts's emptyRow for the full rationale).
    expect(draft.data[0]).toEqual({ x: "", y: "", group: "" });
  });

  it("seeds scatterplot_matrix's default 3 vars from its own varsOptions", () => {
    const draft = defaultDraft("scatterplot_matrix");
    expect(draft.vars).toEqual(["sepal_length", "sepal_width", "petal_length"]);
    expect(draft.data[0]).toEqual({ sepal_length: "", sepal_width: "", petal_length: "", group: "" });
  });

  it("seeds extra fields from each chart's own field descriptors", () => {
    const draft = defaultDraft("bar");
    expect(draft.extra).toEqual({ width: 0.9, sort: false });
  });
});

describe("buildRequestBody", () => {
  it("drops fully-blank rows and keeps filled ones", () => {
    const draft = defaultDraft("bar");
    draft.data[0] = { category: "蘋果", value: "30" };
    const body = buildRequestBody(draft, "png");
    expect(body.data).toEqual([{ category: "蘋果", value: 30 }]);
  });

  it("omits data entirely when every row is blank", () => {
    const draft = defaultDraft("bar");
    const body = buildRequestBody(draft, "png");
    expect(body.data).toBeUndefined();
  });

  it("coerces numeric text-input strings to numbers, leaves text columns as strings", () => {
    const draft = defaultDraft("scatter");
    draft.data[0] = { x: "1.5", y: "2.5", group: "A" };
    const body = buildRequestBody(draft, "plotly-json");
    expect(body.data).toEqual([{ x: 1.5, y: 2.5, group: "A" }]);
  });

  it("converts number-list rows (histogram/distplot) to a plain number array", () => {
    const draft = defaultDraft("histogram");
    draft.data = [{ value: "1" }, { value: "2.5" }, { value: "" }];
    const body = buildRequestBody(draft, "png");
    expect(body.data).toEqual([1, 2.5]);
  });

  it("blank xLabel/yLabel/title become null, not empty string", () => {
    const draft = defaultDraft("scatter");
    const body = buildRequestBody(draft, "png");
    expect(body.xLabel).toBeNull();
    expect(body.yLabel).toBeNull();
  });

  it("blank numeric-draft fields (xMin/xMax/...) become null, a non-blank one becomes a number", () => {
    const draft = defaultDraft("scatter");
    draft.xMin = "0";
    draft.xMax = "not-a-number";
    const body = buildRequestBody(draft, "png");
    expect(body.xMin).toBe(0);
    expect(body.xMax).toBeNull();
  });

  it("omits palette when empty, includes it when set", () => {
    const draft = defaultDraft("bar");
    expect(buildRequestBody(draft, "png").palette).toBeUndefined();
    draft.palette = ["#111111", "#222222"];
    expect(buildRequestBody(draft, "png").palette).toEqual(["#111111", "#222222"]);
  });

  it("carries every extra field from the chart's own descriptor into the top-level body", () => {
    const draft = defaultDraft("scatter");
    draft.extra.trend = "lm";
    draft.extra.pointSize = 5;
    const body = buildRequestBody(draft, "png");
    expect(body.trend).toBe("lm");
    expect(body.pointSize).toBe(5);
  });

  it("includes vars only for scatterplot_matrix", () => {
    const scatterBody = buildRequestBody(defaultDraft("scatter"), "png");
    expect(scatterBody.vars).toBeUndefined();
    const matrixBody = buildRequestBody(defaultDraft("scatterplot_matrix"), "png");
    expect(matrixBody.vars).toEqual(["sepal_length", "sepal_width", "petal_length"]);
  });
});

describe("draftFromRequestBody (round-trip with buildRequestBody)", () => {
  it("rehydrates a saved bar chart's data, colors, and extra fields", () => {
    const saved: ChartRequestBody = {
      chart: "bar",
      format: "plotly-json",
      title: "My Chart",
      showTitle: true,
      xLabel: null,
      yLabel: null,
      xLabelPosition: "center",
      yLabelPosition: "center",
      showLegend: true,
      showGrid: true,
      xMin: null,
      xMax: null,
      yMin: null,
      yMax: null,
      squareGrid: false,
      gridStep: null,
      backgroundColor: null,
      gridColor: null,
      showBorderTop: false,
      showBorderBottom: false,
      showBorderLeft: false,
      showBorderRight: false,
      colors: { 香蕉: "#ffcc00" },
      palette: ["#111111", "#222222"],
      data: [{ category: "香蕉", value: 50 }],
      width: 0.7,
      sort: true,
    };
    const draft = draftFromRequestBody(saved);
    expect(draft.chartType).toBe("bar");
    expect(draft.title).toBe("My Chart");
    expect(draft.colors).toEqual({ 香蕉: "#ffcc00" });
    expect(draft.palette).toEqual(["#111111", "#222222"]);
    // Padded up to 5 rows even though only 1 was saved (see
    // draftFromRequestBody's own comment) — the real saved row stays first,
    // followed by blank rows ready to fill in.
    expect(draft.data[0]).toEqual({ category: "香蕉", value: 50 });
    expect(draft.data).toHaveLength(5);
    expect(draft.extra).toEqual({ width: 0.7, sort: true });

    // Re-serializing the rehydrated draft reproduces the same request body
    // (modulo format) — the padded blank rows get filtered back out by
    // buildRequestBody's own blank-row drop, so this still round-trips.
    const rebuilt = buildRequestBody(draft, "plotly-json");
    expect(rebuilt).toEqual(saved);
  });

  it("pads back to 5 rows when a saved chart has fewer", () => {
    const saved: ChartRequestBody = {
      chart: "bar",
      format: "plotly-json",
      title: "",
      showTitle: true,
      xLabel: null,
      yLabel: null,
      xLabelPosition: "center",
      yLabelPosition: "center",
      showLegend: true,
      showGrid: true,
      xMin: null,
      xMax: null,
      yMin: null,
      yMax: null,
      squareGrid: false,
      gridStep: null,
      backgroundColor: null,
      gridColor: null,
      showBorderTop: false,
      showBorderBottom: false,
      showBorderLeft: false,
      showBorderRight: false,
      colors: {},
      data: [{ category: "A", value: 1 }],
      width: 0.9,
      sort: false,
    };
    const draft = draftFromRequestBody(saved);
    expect(draft.data.length).toBeGreaterThanOrEqual(5);
    expect(draft.data[0]).toEqual({ category: "A", value: 1 });
  });

  it("falls back to each field's own default when the saved body omits an extra field", () => {
    const saved: ChartRequestBody = {
      chart: "scatter",
      format: "plotly-json",
      title: "",
      showTitle: true,
      xLabel: null,
      yLabel: null,
      xLabelPosition: "center",
      yLabelPosition: "center",
      showLegend: true,
      showGrid: true,
      xMin: null,
      xMax: null,
      yMin: null,
      yMax: null,
      squareGrid: false,
      gridStep: null,
      backgroundColor: null,
      gridColor: null,
      showBorderTop: false,
      showBorderBottom: false,
      showBorderLeft: false,
      showBorderRight: false,
      colors: {},
      data: [{ x: 1, y: 2, group: "A" }],
      // trend/pointSize/alpha/groupLabel all deliberately omitted
    };
    const draft = draftFromRequestBody(saved);
    expect(draft.extra).toEqual({ pointSize: 3, alpha: 0.8, trend: "none", trendLabel: "", groupLabel: "group" });
  });
});
