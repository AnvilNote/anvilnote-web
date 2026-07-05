"use client";

import { useEffect, useState, type MouseEvent as ReactMouseEvent, useRef } from "react";
import { createPortal } from "react-dom";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { AlignCenter, AlignLeft, AlignRight, Crop, RotateCcw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageCropDialog } from "@/components/editor/image-crop-dialog";
import { CaptionInput } from "@/components/editor/caption-input";

type ImageAlign = "left" | "center" | "right";

function normalizeAlign(value: unknown): ImageAlign {
  return value === "left" || value === "right" ? value : "center";
}

// Full-viewport blurred-backdrop preview, opened by clicking the image
// itself. Portaled to document.body — not rendered in place — for the same
// reason link-input.tsx/text-color-picker.tsx are: the editor column has
// `transform-gpu` a few levels up (kept so the pinned footnotes panel has a
// stable containing block), which becomes the containing block for any
// `position: fixed` descendant instead of the viewport, silently offsetting
// a backdrop meant to cover the whole screen.
function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <button
        type="button"
        aria-label={t("close")}
        title={t("close")}
        onClick={onClose}
        className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
      >
        <X className="size-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-[90vh] max-w-[90vw] object-contain shadow-2xl"
      />
    </div>,
    document.body,
  );
}

// React NodeView for images: drag the right-edge handle to resize (stored as a
// width percentage of the editor width), pick left/center/right alignment
// from the overlay shown on hover, and click the image itself to open an
// enlarged, blurred-backdrop preview.
export function ImageNodeView({
  node,
  updateAttributes,
  editor,
  deleteNode,
}: NodeViewProps) {
  const t = useTranslations("editor.image");
  const tBlock = useTranslations("editor.block");
  const frameRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);

  const align = normalizeAlign(node.attrs.align);
  const width = typeof node.attrs.width === "number" ? node.attrs.width : null;
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const caption = typeof node.attrs.caption === "string" ? node.attrs.caption : "";
  const captionLabel = t("figure");
  const originalSrc = typeof node.attrs.originalSrc === "string" ? node.attrs.originalSrc : null;
  // A PDF-backed image's `src` is a rasterized preview of the real asset
  // (the PDF itself, in `pdfSrc` — see image.ts), not something cropping
  // should touch: there's no sensible way to also apply a crop to the
  // vector PDF that actually gets exported.
  const isPdfImage = typeof node.attrs.pdfSrc === "string" && node.attrs.pdfSrc.length > 0;

  function applyCrop(newSrc: string) {
    updateAttributes({
      src: newSrc,
      // Only ever captured once — see the AnvilImage attribute doc comment
      // in image.ts for why overwriting an existing originalSrc would be
      // wrong.
      originalSrc: originalSrc ?? src,
    });
    setCropOpen(false);
  }

  function revertToOriginal() {
    if (originalSrc) updateAttributes({ src: originalSrc });
  }

  function startResize(event: React.PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    const frame = frameRef.current;
    const containerWidth = editor.view.dom.clientWidth;
    if (!frame || !containerWidth) return;
    const left = frame.getBoundingClientRect().left;

    const onMove = (move: PointerEvent) => {
      const next = ((move.clientX - left) / containerWidth) * 100;
      const clamped = Math.max(10, Math.min(100, Math.round(next)));
      updateAttributes({ width: clamped });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleImageClick(event: ReactMouseEvent) {
    // The default atom-node click behavior would otherwise turn this into a
    // ProseMirror NodeSelection — harmless, but pointless now that click's
    // whole job here is opening the preview instead.
    event.preventDefault();
    setZoomed(true);
  }

  return (
    <NodeViewWrapper
      className={cn("anvil-image", hovered && "anvil-image--hovered")}
      data-align={align}
    >
      <figure
        ref={frameRef}
        className="anvil-image__figure"
        style={width != null ? { width: `${width}%` } : undefined}
      >
        <div
          className="anvil-image__frame"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            onClick={handleImageClick}
            className="cursor-zoom-in"
          />

          {hovered ? (
            <>
              <div
                className="anvil-image__toolbar"
                contentEditable={false}
              >
                {(["left", "center", "right"] as const).map((value) => {
                  const Icon =
                    value === "left"
                      ? AlignLeft
                      : value === "right"
                        ? AlignRight
                        : AlignCenter;
                  return (
                    <button
                      key={value}
                      type="button"
                      title={t(value)}
                      aria-label={t(value)}
                      aria-pressed={align === value}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => updateAttributes({ align: value })}
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                        align === value && "bg-accent text-foreground",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </button>
                  );
                })}
                {!isPdfImage ? (
                  <>
                    <span className="mx-0.5 h-4 w-px bg-border" />
                    <button
                      type="button"
                      title={t("crop")}
                      aria-label={t("crop")}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setCropOpen(true)}
                      className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Crop className="size-3.5" />
                    </button>
                    {originalSrc && originalSrc !== src ? (
                      <button
                        type="button"
                        title={t("revertCrop")}
                        aria-label={t("revertCrop")}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={revertToOriginal}
                        className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <RotateCcw className="size-3.5" />
                      </button>
                    ) : null}
                  </>
                ) : null}
                <span className="mx-0.5 h-4 w-px bg-border" />
                <button
                  type="button"
                  title={tBlock("delete", { type: tBlock("types.image") })}
                  aria-label={tBlock("delete", { type: tBlock("types.image") })}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={deleteNode}
                  className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <span
                className="anvil-image__handle"
                onPointerDown={startResize}
                contentEditable={false}
                aria-hidden
              />
            </>
          ) : null}
        </div>
        <figcaption className="anvil-image__caption" contentEditable={false}>
          <span
            className="anvil-image__caption-label"
            data-label={captionLabel}
          />
          <CaptionInput
            value={caption}
            placeholder={t("captionPlaceholder")}
            onChange={(value) => updateAttributes({ caption: value })}
            className="anvil-caption-input"
          />
        </figcaption>
      </figure>

      {zoomed ? (
        <ImageLightbox src={src} alt={alt} onClose={() => setZoomed(false)} />
      ) : null}

      {cropOpen ? (
        <ImageCropDialog
          src={src}
          open={cropOpen}
          onOpenChange={setCropOpen}
          onApply={applyCrop}
        />
      ) : null}
    </NodeViewWrapper>
  );
}
