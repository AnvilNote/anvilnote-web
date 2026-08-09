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
import { Switch } from "@/components/ui/switch";

// A sensible starting selection: centered, 90% of the image on its shorter
// axis. aspect: undefined lets the user drag freely; a number pins the
// selection box to that ratio (1 = square) the same way makeAspectCrop's
// own `aspect` param works.
function defaultCrop(width: number, height: number, aspect: number | undefined): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, aspect ?? width / height, width, height),
    width,
    height,
  );
}

// Same shape as image-crop-dialog.tsx (that one crops an inserted document
// image; this one is for the watermark settings panel specifically) with
// one addition: an aspect-lock toggle, since a watermark logo commonly
// wants a fixed square/ratio crop rather than the free-form drag the
// document-image cropper always allows.
export function WatermarkCropDialog({
  src,
  open,
  onOpenChange,
  aspectLocked,
  onAspectLockedChange,
  onApply,
}: {
  src: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aspectLocked: boolean;
  onAspectLockedChange: (locked: boolean) => void;
  onApply: (croppedSrc: string) => void;
}) {
  const t = useTranslations("settings.watermark");
  const tCommon = useTranslations("common");
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

  function resetCrop(aspect: number | undefined) {
    const image = imgRef.current;
    if (!image) return;
    const { naturalWidth, naturalHeight } = image;
    const initial = defaultCrop(naturalWidth, naturalHeight, aspect);
    setCrop(initial);
    // Same reasoning as image-crop-dialog.tsx's own onLoad handler: ReactCrop
    // only fires onComplete/onChange from its own pointer handling, never
    // just because the controlled `crop` prop changed programmatically.
    setCompletedCrop(convertToPixelCrop(initial, naturalWidth, naturalHeight));
  }

  function toggleAspectLocked(next: boolean) {
    onAspectLockedChange(next);
    resetCrop(next ? 1 : undefined);
  }

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

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("aspectLocked")}</span>
          <Switch
            checked={aspectLocked}
            aria-label={t("aspectLocked")}
            onCheckedChange={toggleAspectLocked}
          />
        </div>

        <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-md border bg-muted/30 p-2">
          <ReactCrop
            crop={crop}
            aspect={aspectLocked ? 1 : undefined}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt=""
              onLoad={() => resetCrop(aspectLocked ? 1 : undefined)}
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
