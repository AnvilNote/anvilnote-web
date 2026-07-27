import { afterEach, describe, expect, test, vi } from "vitest";
import { defaultFunctionPlotSpec } from "@/lib/tiptap/function-plot";
import { renderFunctionPlot } from "./function-plot-render";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("renderFunctionPlot", () => {
  test("returns the base64 PDF", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ pdf: "QUJD" }), { status: 200 }),
    ) as typeof fetch;

    const pdf = await renderFunctionPlot({
      ...defaultFunctionPlotSpec(),
      curves: [
        {
          ...defaultFunctionPlotSpec().curves[0],
          expr: "x**2",
        },
      ],
    });
    expect(pdf).toBe("QUJD");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/funcs/render"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("surfaces the API error message", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: { message: "unsupported expression" } }),
        { status: 422 },
      ),
    ) as typeof fetch;

    await expect(
      renderFunctionPlot(defaultFunctionPlotSpec()),
    ).rejects.toThrow("unsupported expression");
  });
});
