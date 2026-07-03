"use client";

import { useRef } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { AlignCenter, AlignLeft, AlignRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ImageAlign = "left" | "center" | "right";

function normalizeAlign(value: unknown): ImageAlign {
  return value === "left" || value === "right" ? value : "center";
}

// React NodeView for images: drag the right-edge handle to resize (stored as a
// width percentage of the editor width) and pick left/center/right alignment
// from the overlay shown while the image is selected.
export function ImageNodeView({
  node,
  updateAttributes,
  selected,
  editor,
  deleteNode,
}: NodeViewProps) {
  const t = useTranslations("editor.image");
  const tBlock = useTranslations("editor.block");
  const frameRef = useRef<HTMLDivElement>(null);

  const align = normalizeAlign(node.attrs.align);
  const width = typeof node.attrs.width === "number" ? node.attrs.width : null;
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const caption = typeof node.attrs.caption === "string" ? node.attrs.caption : "";
  const captionLabel = t("figure");

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

  return (
    <NodeViewWrapper
      className={cn("anvil-image", selected && "anvil-image--selected")}
      data-align={align}
    >
      <figure
        ref={frameRef}
        className="anvil-image__figure"
        style={width != null ? { width: `${width}%` } : undefined}
      >
        <div className="anvil-image__frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} draggable={false} />

          {selected ? (
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
          <input
            type="text"
            value={caption}
            placeholder={t("captionPlaceholder")}
            onChange={(event) =>
              updateAttributes({ caption: event.currentTarget.value })
            }
            onMouseDown={(event) => event.stopPropagation()}
            className="anvil-caption-input"
          />
        </figcaption>
      </figure>
    </NodeViewWrapper>
  );
}
