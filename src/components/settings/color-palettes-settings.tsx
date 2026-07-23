"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerEyeDropper,
  ColorPickerOutput,
  ColorPickerFormat,
} from "@/components/ui/color-picker";
import {
  useCustomPalettesStore,
  MAX_CUSTOM_PALETTE_COLORS,
  type CustomPalette,
} from "@/lib/stores/custom-palettes-store";

export function ColorPalettesSettings() {
  const t = useTranslations("settings.colorPalettes");
  const tc = useTranslations("common");
  const palettes = useCustomPalettesStore((s) => s.palettes);
  const addPalette = useCustomPalettesStore((s) => s.addPalette);
  const removePalette = useCustomPalettesStore((s) => s.removePalette);
  const [newPaletteName, setNewPaletteName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CustomPalette | null>(null);

  function handleAddPalette() {
    addPalette(newPaletteName.trim() || t("newPalettePlaceholder"));
    setNewPaletteName("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="new-palette-name" className="text-xs text-muted-foreground">
            {t("newPalette")}
          </Label>
          <Input
            id="new-palette-name"
            value={newPaletteName}
            onChange={(event) => setNewPaletteName(event.target.value)}
            placeholder={t("newPalettePlaceholder")}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddPalette();
              }
            }}
          />
        </div>
        <Button type="button" size="sm" onClick={handleAddPalette} className="gap-1.5">
          <Plus className="size-3.5" />
          {t("newPalette")}
        </Button>
      </div>

      {palettes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noPalettes")}</p>
      ) : (
        <div className="space-y-5">
          {palettes.map((palette) => (
            <PaletteEditor
              key={palette.id}
              palette={palette}
              onRequestDelete={() => setDeleteTarget(palette)}
            />
          ))}
        </div>
      )}

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("removePaletteTitle", { name: deleteTarget?.name ?? "" })}</DialogTitle>
            <DialogDescription>{t("removePaletteDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{tc("cancel")}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) removePalette(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              {t("removePalette")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaletteEditor({
  palette,
  onRequestDelete,
}: {
  palette: CustomPalette;
  onRequestDelete: () => void;
}) {
  const t = useTranslations("settings.colorPalettes");
  const renamePalette = useCustomPalettesStore((s) => s.renamePalette);
  const addColor = useCustomPalettesStore((s) => s.addColor);
  const updateColor = useCustomPalettesStore((s) => s.updateColor);
  const removeColor = useCustomPalettesStore((s) => s.removeColor);
  // Local draft so every keystroke doesn't rename in the store — commits
  // on blur, same "don't fight the user mid-edit" shape as elsewhere.
  const [nameDraft, setNameDraft] = useState(palette.name);
  const [openColorIndex, setOpenColorIndex] = useState<number | null>(null);

  const atMax = palette.colors.length >= MAX_CUSTOM_PALETTE_COLORS;

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="flex items-center gap-2">
        <Input
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={() => {
            const trimmed = nameDraft.trim();
            if (trimmed && trimmed !== palette.name) renamePalette(palette.id, trimmed);
            else setNameDraft(palette.name);
          }}
          aria-label={t("renamePalette")}
          className="h-8 max-w-48 text-sm font-medium"
        />
        <span className="text-xs text-muted-foreground">
          {t("colorCount", { count: palette.colors.length, max: MAX_CUSTOM_PALETTE_COLORS })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("removePalette")}
          className="ml-auto text-muted-foreground hover:text-destructive"
          onClick={onRequestDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {palette.colors.map((color, index) => (
          <Popover
            key={index}
            open={openColorIndex === index}
            onOpenChange={(open) => setOpenColorIndex(open ? index : null)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent"
              >
                <span
                  className="size-4 shrink-0 rounded-sm border"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="max-w-20 truncate">{color.name || color.hex}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-3">
                <ColorPicker
                  className="gap-3"
                  value={color.hex}
                  onChange={(rgba) => {
                    const [r, g, b] = rgba as [number, number, number, number];
                    const hex = `#${[r, g, b]
                      .map((c) => Math.round(c).toString(16).padStart(2, "0"))
                      .join("")}`;
                    updateColor(palette.id, index, { hex });
                  }}
                >
                  <ColorPickerSelection className="h-32" />
                  <ColorPickerHue />
                  <div className="flex items-center gap-2">
                    <ColorPickerEyeDropper />
                    <ColorPickerOutput />
                  </div>
                  <ColorPickerFormat />
                </ColorPicker>
                <Input
                  value={color.name}
                  onChange={(event) => updateColor(palette.id, index, { name: event.target.value })}
                  placeholder={t("colorNamePlaceholder")}
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => {
                    removeColor(palette.id, index);
                    setOpenColorIndex(null);
                  }}
                >
                  <X className="size-3.5" />
                  {t("removeColor")}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={atMax}
          onClick={() => addColor(palette.id, "#000000")}
          className="gap-1.5"
        >
          <Plus className="size-3.5" />
          {t("addColor")}
        </Button>
      </div>
      {atMax ? (
        <p className="text-xs text-muted-foreground">
          {t("maxColorsReached", { max: MAX_CUSTOM_PALETTE_COLORS })}
        </p>
      ) : null}
    </div>
  );
}
