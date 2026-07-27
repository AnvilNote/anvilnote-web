// Renders a PDF's first page to a PNG data URL, client-side, so a PDF
// inserted as an "image" has something the browser's <img> tag can actually
// display — <img> only decodes true raster/vector image formats, never
// application/pdf, no matter what the src's MIME claims. The original PDF
// is kept separately (image.ts's pickAndInsertImage stores it as the image
// node's `pdfSrc` attribute) so export to Typst — which CAN embed a PDF
// natively as of Typst 0.14 — still gets the crisp vector original instead
// of this rasterized stand-in.
async function renderPdfBufferToPng(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Same worker-resolution pattern as template-pdf-viewer.tsx: the
  // `import.meta.url` form lets the bundler emit the worker as a static
  // asset and resolve its URL, no manual /public copy.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);
  // 2x scale for a reasonably crisp preview on high-DPI screens; this is
  // only ever shown at editor width, not exported, so no need to match the
  // original PDF's own resolution.
  const viewport = page.getViewport({ scale: 2 });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context unavailable");
  }

  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas.toDataURL("image/png");
}

export async function renderPdfFirstPageToPng(file: File): Promise<string> {
  return renderPdfBufferToPng(await file.arrayBuffer());
}

export async function renderPdfBase64ToPng(base64: string): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return renderPdfBufferToPng(bytes.buffer);
}
