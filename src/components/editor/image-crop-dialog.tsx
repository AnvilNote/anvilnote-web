"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  cropToCanvas,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// A sensible starting selection: centered, 90% of the image on its shorter
// axis, no fixed aspect ratio (the user drags freely from there).
function defaultCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, width / height, width, height),
    width,
    height,
  );
}

export function ImageCropDialog({
  src,
  open,
  onOpenChange,
  onApply,
}: {
  src: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (croppedSrc: string) => void;
}) {
  const t = useTranslations("editor.image");
  const tCommon = useTranslations("common");
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

  function handleApply() {
    const image = imgRef.current;
    if (!image || !completedCrop || !completedCrop.width || !completedCrop.height) return;
    const canvas = document.createElement("canvas");
    void cropToCanvas(image, canvas, completedCrop).then(() => {
      onApply(canvas.toDataURL("image/png"));
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("cropTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-md border bg-muted/30 p-2">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt=""
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                const initial = defaultCrop(naturalWidth, naturalHeight);
                setCrop(initial);
                // ReactCrop's onComplete/onChange only fire from the
                // component's OWN pointer handling, never just because the
                // controlled `crop` prop changed programmatically — without
                // this, opening the dialog and clicking Save immediately
                // (without first nudging the visible default selection)
                // left completedCrop unset and did nothing, despite a
                // crop clearly being shown on screen.
                setCompletedCrop(convertToPixelCrop(initial, naturalWidth, naturalHeight));
              }}
              className="max-h-[65vh]"
            />
          </ReactCrop>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleApply} disabled={!completedCrop?.width}>
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
