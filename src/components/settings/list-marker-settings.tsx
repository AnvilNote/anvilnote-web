"use client";

import { useTranslations } from "next-intl";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/lib/stores/settings-store";
import {
  ORDERED_MODULE_IDS,
  UNORDERED_SYMBOLS,
  UNORDERED_SYMBOL_KEYS,
  renderOrderedMarker,
  type OrderedModuleId,
  type UnorderedSymbol,
} from "@/lib/list-markers/marker-modules";

export function ListMarkerSettings() {
  const t = useTranslations("settings.listMarkers");
  const orderedListLevels = useSettingsStore((s) => s.orderedListLevels);
  const unorderedListLevels = useSettingsStore((s) => s.unorderedListLevels);
  const setOrderedListLevel = useSettingsStore((s) => s.setOrderedListLevel);
  const addOrderedListLevel = useSettingsStore((s) => s.addOrderedListLevel);
  const removeOrderedListLevel = useSettingsStore((s) => s.removeOrderedListLevel);
  const setUnorderedListLevel = useSettingsStore((s) => s.setUnorderedListLevel);
  const addUnorderedListLevel = useSettingsStore((s) => s.addUnorderedListLevel);
  const removeUnorderedListLevel = useSettingsStore((s) => s.removeUnorderedListLevel);
  const resetOrderedListLevels = useSettingsStore((s) => s.resetOrderedListLevels);
  const resetUnorderedListLevels = useSettingsStore((s) => s.resetUnorderedListLevels);

  return (
    <Tabs defaultValue="ordered">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="ordered">{t("ordered")}</TabsTrigger>
        <TabsTrigger value="unordered">{t("unordered")}</TabsTrigger>
      </TabsList>

      <TabsContent value="ordered">
        <div className="divide-y">
          {orderedListLevels.map((moduleId, index) => (
            <div className="flex items-center gap-2 py-2" key={index}>
              <span className="w-14 shrink-0 text-xs text-muted-foreground">
                {t("level", { level: index + 1 })}
              </span>
              <Select
                onValueChange={(value) => setOrderedListLevel(index, value as OrderedModuleId)}
                value={moduleId}
              >
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {ORDERED_MODULE_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {t(`modules.${id}`)} — {renderOrderedMarker(id, 1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                aria-label={t("removeLevel")}
                disabled={orderedListLevels.length <= 1}
                onClick={() => removeOrderedListLevel(index)}
                size="icon"
                variant="ghost"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <Button
            onClick={() => addOrderedListLevel(ORDERED_MODULE_IDS[0])}
            size="sm"
            variant="outline"
          >
            <Plus className="size-3.5" />
            {t("addOrderedLevel")}
          </Button>
          <Button onClick={resetOrderedListLevels} size="sm" variant="ghost">
            <RotateCcw className="size-3.5" />
            {t("resetToDefault")}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="unordered">
        <div className="divide-y">
          {unorderedListLevels.map((symbol, index) => (
            <div className="flex items-center gap-2 py-2" key={index}>
              <span className="w-14 shrink-0 text-xs text-muted-foreground">
                {t("level", { level: index + 1 })}
              </span>
              <Select
                onValueChange={(value) =>
                  setUnorderedListLevel(index, value as UnorderedSymbol)
                }
                value={symbol}
              >
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {UNORDERED_SYMBOLS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s} {t(`symbols.${UNORDERED_SYMBOL_KEYS[s]}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                aria-label={t("removeLevel")}
                disabled={unorderedListLevels.length <= 1}
                onClick={() => removeUnorderedListLevel(index)}
                size="icon"
                variant="ghost"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <Button
            onClick={() => addUnorderedListLevel(UNORDERED_SYMBOLS[0])}
            size="sm"
            variant="outline"
          >
            <Plus className="size-3.5" />
            {t("addUnorderedLevel")}
          </Button>
          <Button onClick={resetUnorderedListLevels} size="sm" variant="ghost">
            <RotateCcw className="size-3.5" />
            {t("resetToDefault")}
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
