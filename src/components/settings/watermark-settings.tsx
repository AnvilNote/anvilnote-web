"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon, Type as TypeIcon, Upload } from "lucide-react";
import { SettingsRow } from "@/components/settings/settings-section";
import { WatermarkCropDialog } from "@/components/settings/watermark-crop-dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSettingsStore,
  type WatermarkFontFamily,
  type WatermarkType,
} from "@/lib/stores/settings-store";

// Narrower than image.ts's own SUPPORTED_IMAGE_MIME_TYPES (which also
// accepts gif/webp/svg/pdf for document-body images) -- per explicit
// requirement, a watermark upload only ever accepts png/jpg.
const WATERMARK_MIME_TYPES = ["image/png", "image/jpeg"] as const;

// Same AnvilNote feather-logo SVG the renderer's own bundled default watermark
// asset is rasterized from (anvilnote-renderer/assets/watermark-default.png,
// generated from anvilnote-web/public/favicon-dark.svg) -- shown here so the
// preview matches what an unset watermark.image actually renders as in the
// exported PDF, instead of a generic placeholder icon.
const DEFAULT_WATERMARK_LOGO_SRC = "/favicon-dark.svg";

// Repeating "paragraphs" of fake body text (varying-width bars, last line of
// each paragraph shorter -- the standard skeleton-loader look for
// representing wrapped text without real words). Cycled and clipped by the
// flex-1 overflow-hidden body container below, so the mock page fills edge
// to edge regardless of the preview box's actual rendered height, instead of
// a fixed paragraph count that could leave dead space at the bottom. First
// paragraph's first line gets an extra left offset, mirroring this app's own
// first-line paragraph indent (paragraph-indent.ts) so the mock page reads
// as an actual document, not a generic placeholder box.
const MOCK_PARAGRAPHS = [
  ["92%", "88%", "95%", "60%"],
  ["90%", "93%", "70%"],
  ["85%", "91%", "94%", "55%"],
  ["88%", "80%"],
];
const MOCK_BODY_REPEATS = 3;

// Approximations of build-entry.ts's serif/sans/rounded watermark-text font
// stacks (anvil-fonts.typ's body-fonts / title-fonts / watermark-rounded-
// fonts) using whatever's actually installed in the user's browser -- this
// preview can't load the bundled Typst fonts (Baloo 2 etc.), so it's a
// approximation, not a pixel match.
const PREVIEW_FONT_STACK: Record<WatermarkFontFamily, string> = {
  serif: "Georgia, Cambria, 'Times New Roman', 'Noto Serif', serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', sans-serif",
  rounded: "ui-rounded, 'SF Pro Rounded', 'Baloo 2', 'Comfortaa', sans-serif",
};

// A mock A4 page (210:297 ratio) with a fake title/subtitle/date/author
// header, placeholder body-text bars filling the rest of the page, and a
// page number -- behind a centered, rotated, faded rendering of the current
// watermark config. Always a plain white "page" regardless of the app's own
// light/dark theme, same reasoning an actual print preview would: this
// represents a physical page, not app chrome. Not pixel-exact to what
// build-entry.ts's #set page(background: ...) actually produces (that's
// Typst's own layout engine, not CSS) -- just enough for the user to
// sanity-check rotation/opacity/placement/font before exporting.
function WatermarkPreview({
  type,
  image,
  text,
  fontFamily,
  sizePercent,
  rotationDeg,
  opacityPercent,
}: {
  type: WatermarkType;
  image: string | null;
  text: string;
  fontFamily: WatermarkFontFamily;
  sizePercent: number;
  rotationDeg: number;
  opacityPercent: number;
}) {
  return (
    <div
      className="relative mx-auto flex flex-col overflow-hidden rounded-md border bg-white shadow-sm"
      style={{ width: "78%", aspectRatio: "210 / 297" }}
    >
      <div className="absolute inset-0 flex flex-col p-6">
        {/* Title / subtitle / date / author mock header */}
        <div className="flex flex-col gap-2 pb-4">
          <div className="h-3.5 w-3/4 rounded-full bg-gray-400" />
          <div className="h-2 w-1/2 rounded-full bg-gray-300" />
          <div className="mt-1.5 flex gap-3">
            <div className="h-1.5 w-14 rounded-full bg-gray-200" />
            <div className="h-1.5 w-20 rounded-full bg-gray-200" />
          </div>
        </div>

        {/* Body: repeated + clipped so the mock text fills the whole page */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {Array.from({ length: MOCK_BODY_REPEATS }).flatMap((_, repeatIndex) =>
            MOCK_PARAGRAPHS.map((lines, pIndex) => (
              <div key={`${repeatIndex}-${pIndex}`} className="flex flex-col gap-2">
                {lines.map((width, lIndex) => (
                  <div
                    key={lIndex}
                    className="h-2 shrink-0 rounded-full bg-gray-200"
                    style={{
                      width,
                      marginLeft:
                        repeatIndex === 0 && pIndex === 0 && lIndex === 0 ? "2rem" : undefined,
                    }}
                  />
                ))}
              </div>
            )),
          )}
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          style={{
            transform: `rotate(${rotationDeg}deg) scale(${sizePercent / 100})`,
            opacity: opacityPercent / 100,
          }}
          className="flex items-center justify-center"
        >
          {type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image ?? DEFAULT_WATERMARK_LOGO_SRC}
              alt=""
              className="max-h-24 max-w-48 object-contain"
            />
          ) : (
            <span
              className="max-w-64 truncate text-3xl font-semibold text-muted-foreground"
              style={{ fontFamily: PREVIEW_FONT_STACK[fontFamily] }}
            >
              {text || "AnvilNote"}
            </span>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-2.5 text-center text-[10px] text-gray-400">1</div>
    </div>
  );
}

export function WatermarkSettings() {
  const t = useTranslations("settings.watermark");
  const watermark = useSettingsStore((s) => s.watermark);
  const setWatermark = useSettingsStore((s) => s.setWatermark);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  function pickImage() {
    fileInputRef.current?.click();
  }

  function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !(WATERMARK_MIME_TYPES as readonly string[]).includes(file.type)) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingSrc(reader.result as string);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  }

  return (
    <>
      <SettingsRow
        id="watermark-enabled"
        label={t("enabled")}
        hint={t("enabledHint")}
        control={
          <Switch
            checked={watermark.enabled}
            aria-label={t("enabled")}
            onCheckedChange={(checked) => setWatermark({ enabled: checked })}
          />
        }
      />

      {watermark.enabled ? (
        <>
          <SettingsRow
            id="watermark-firstPage"
            label={t("applyToFirstPage")}
            hint={t("applyToFirstPageHint")}
            control={
              <Switch
                checked={watermark.applyToFirstPage}
                aria-label={t("applyToFirstPage")}
                onCheckedChange={(checked) => setWatermark({ applyToFirstPage: checked })}
              />
            }
          />

          <SettingsRow
            id="watermark-type"
            label={t("type")}
            control={
              <Select
                value={watermark.type}
                onValueChange={(v) => setWatermark({ type: v as WatermarkType })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="image">
                    <ImageIcon className="size-4" />
                    {t("typeImage")}
                  </SelectItem>
                  <SelectItem value="text">
                    <TypeIcon className="size-4" />
                    {t("typeText")}
                  </SelectItem>
                </SelectContent>
              </Select>
            }
          />

          {watermark.type === "image" ? (
            <SettingsRow
              id="watermark-image"
              label={t("image")}
              hint={watermark.image ? undefined : t("imageDefaultHint")}
              control={
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={WATERMARK_MIME_TYPES.join(",")}
                    className="hidden"
                    onChange={onFileSelected}
                  />
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={pickImage}>
                    <Upload className="size-3.5" />
                    {t("upload")}
                  </Button>
                  {watermark.image ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setWatermark({ image: null })}
                    >
                      {t("resetToDefault")}
                    </Button>
                  ) : null}
                </div>
              }
            />
          ) : (
            <>
              <SettingsRow
                id="watermark-text"
                label={t("text")}
                control={
                  <Input
                    className="w-56"
                    value={watermark.text}
                    placeholder="AnvilNote"
                    onChange={(event) => setWatermark({ text: event.target.value })}
                  />
                }
              />

              <SettingsRow
                id="watermark-fontFamily"
                label={t("fontFamily")}
                control={
                  <Select
                    value={watermark.fontFamily}
                    onValueChange={(v) => setWatermark({ fontFamily: v as WatermarkFontFamily })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="serif">{t("fontFamilySerif")}</SelectItem>
                      <SelectItem value="sans">{t("fontFamilySans")}</SelectItem>
                      <SelectItem value="rounded">{t("fontFamilyRounded")}</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
            </>
          )}

          <SettingsRow
            id="watermark-size"
            label={watermark.type === "image" ? t("imageSize") : t("textSize")}
            control={
              <div className="flex w-56 items-center gap-3">
                <Slider
                  className="flex-1"
                  min={30}
                  max={250}
                  step={5}
                  value={[watermark.sizePercent]}
                  onValueChange={([v]) => setWatermark({ sizePercent: v })}
                />
                <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {watermark.sizePercent}%
                </span>
              </div>
            }
          />

          <SettingsRow
            id="watermark-rotation"
            label={t("rotation")}
            control={
              <div className="flex w-56 items-center gap-3">
                <Slider
                  className="flex-1"
                  min={-180}
                  max={180}
                  step={1}
                  value={[watermark.rotationDeg]}
                  onValueChange={([v]) => setWatermark({ rotationDeg: v })}
                />
                <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {watermark.rotationDeg}°
                </span>
              </div>
            }
          />

          <SettingsRow
            id="watermark-opacity"
            label={t("opacity")}
            control={
              <div className="flex w-56 items-center gap-3">
                <Slider
                  className="flex-1"
                  min={5}
                  max={100}
                  step={1}
                  value={[watermark.opacityPercent]}
                  onValueChange={([v]) => setWatermark({ opacityPercent: v })}
                />
                <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {watermark.opacityPercent}%
                </span>
              </div>
            }
          />

          <div className="pt-2">
            <WatermarkPreview
              type={watermark.type}
              image={watermark.image}
              text={watermark.text}
              fontFamily={watermark.fontFamily}
              sizePercent={watermark.sizePercent}
              rotationDeg={watermark.rotationDeg}
              opacityPercent={watermark.opacityPercent}
            />
          </div>
        </>
      ) : null}

      {pendingSrc ? (
        <WatermarkCropDialog
          src={pendingSrc}
          open={cropOpen}
          onOpenChange={(open) => {
            setCropOpen(open);
            if (!open) setPendingSrc(null);
          }}
          aspectLocked={watermark.aspectLocked}
          onAspectLockedChange={(locked) => setWatermark({ aspectLocked: locked })}
          onApply={(croppedSrc) => {
            setWatermark({ image: croppedSrc, type: "image" });
            setCropOpen(false);
            setPendingSrc(null);
          }}
        />
      ) : null}
    </>
  );
}
