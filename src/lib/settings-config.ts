import { deliverFile } from "@/lib/export-target";
import { DATE_FORMATS, type DateFormat } from "@/lib/date-format";
import type { ExportFontPreset, ExportPageSize } from "@/types/export";
import {
  ORDERED_MODULE_IDS,
  UNORDERED_SYMBOLS,
  type OrderedModuleId,
  type UnorderedSymbol,
} from "@/lib/list-markers/marker-modules";
import { VERSION_SNAPSHOT_INTERVAL_OPTIONS, type VersionSnapshotIntervalMinutes } from "@/lib/stores/settings-store";
import type { WritingStyle } from "@anvilnote/ai-writer/contracts";

// Every field is optional on import: a .config file is meant to travel
// across app versions and devices, so a field this version doesn't
// recognize (or doesn't have yet) shouldn't fail the whole import -- it's
// just left at whatever the importing app's own defaults already are. No
// validation library here (the web app doesn't otherwise depend on one) --
// each field gets one small hand-rolled guard instead.
export type SettingsConfig = {
  autosave?: boolean;
  spellcheck?: boolean;
  exportPageSize?: ExportPageSize;
  exportFontPreset?: ExportFontPreset;
  exportStorageLocation?: string;
  versionSnapshotIntervalMinutes?: VersionSnapshotIntervalMinutes;
  defaultAuthor?: string;
  dateFormat?: DateFormat;
  hideTourButton?: boolean;
  holidayEffectsEnabled?: boolean;
  tourButtonPosition?: { right: number; bottom: number } | null;
  aiProviderId?: "openai";
  aiModelId?: string;
  aiHumanizerEnabled?: boolean;
  aiWritingStyle?: WritingStyle;
  orderedListLevels?: OrderedModuleId[];
  unorderedListLevels?: UnorderedSymbol[];
};

const CONFIG_FILENAME = "anvilnote-settings.config";

const WRITING_STYLES: readonly WritingStyle[] = ["auto", "neutral", "natural", "preserve-source"];

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}
function isString(v: unknown): v is string {
  return typeof v === "string";
}
function isOneOf<T>(options: readonly T[], v: unknown): v is T {
  return (options as readonly unknown[]).includes(v);
}
function isTourButtonPosition(v: unknown): v is { right: number; bottom: number } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).right === "number" &&
    typeof (v as Record<string, unknown>).bottom === "number"
  );
}
function isModuleArray(v: unknown): v is OrderedModuleId[] {
  return Array.isArray(v) && v.length > 0 && v.every((id) => isOneOf(ORDERED_MODULE_IDS, id));
}
function isSymbolArray(v: unknown): v is UnorderedSymbol[] {
  return Array.isArray(v) && v.length > 0 && v.every((s) => isOneOf(UNORDERED_SYMBOLS, s));
}

/** Downloads the given settings as a `.config` file (JSON content, custom
 * extension — same convention as the app's own `.anvilnote` format). */
export async function exportSettingsConfig(settings: SettingsConfig) {
  const blob = new Blob([JSON.stringify(settings, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  return deliverFile(blob, CONFIG_FILENAME);
}

/** Parses and validates a `.config` file's text content. Throws if the
 * content isn't valid JSON; individual unrecognized/mistyped keys are
 * silently dropped rather than failing the whole import (see the type's
 * own comment above for why). */
export async function importSettingsConfig(text: string): Promise<SettingsConfig> {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Settings config must be a JSON object");
  }
  const raw = parsed as Record<string, unknown>;
  const config: SettingsConfig = {};
  if (isBoolean(raw.autosave)) config.autosave = raw.autosave;
  if (isBoolean(raw.spellcheck)) config.spellcheck = raw.spellcheck;
  if (isOneOf(["A4", "Letter"] as const, raw.exportPageSize)) {
    config.exportPageSize = raw.exportPageSize;
  }
  if (isOneOf(["sans", "serif", "mono"] as const, raw.exportFontPreset)) {
    config.exportFontPreset = raw.exportFontPreset;
  }
  if (isString(raw.exportStorageLocation)) config.exportStorageLocation = raw.exportStorageLocation;
  if (isOneOf(VERSION_SNAPSHOT_INTERVAL_OPTIONS, raw.versionSnapshotIntervalMinutes)) {
    config.versionSnapshotIntervalMinutes = raw.versionSnapshotIntervalMinutes;
  }
  if (isString(raw.defaultAuthor)) config.defaultAuthor = raw.defaultAuthor;
  if (isOneOf(DATE_FORMATS, raw.dateFormat)) config.dateFormat = raw.dateFormat;
  if (isBoolean(raw.hideTourButton)) config.hideTourButton = raw.hideTourButton;
  if (isBoolean(raw.holidayEffectsEnabled)) config.holidayEffectsEnabled = raw.holidayEffectsEnabled;
  if (raw.tourButtonPosition === null) config.tourButtonPosition = null;
  else if (isTourButtonPosition(raw.tourButtonPosition)) config.tourButtonPosition = raw.tourButtonPosition;
  if (raw.aiProviderId === "openai") config.aiProviderId = "openai";
  if (isString(raw.aiModelId)) config.aiModelId = raw.aiModelId;
  if (isBoolean(raw.aiHumanizerEnabled)) config.aiHumanizerEnabled = raw.aiHumanizerEnabled;
  if (isOneOf(WRITING_STYLES, raw.aiWritingStyle)) config.aiWritingStyle = raw.aiWritingStyle;
  if (isModuleArray(raw.orderedListLevels)) config.orderedListLevels = raw.orderedListLevels;
  if (isSymbolArray(raw.unorderedListLevels)) config.unorderedListLevels = raw.unorderedListLevels;
  return config;
}
