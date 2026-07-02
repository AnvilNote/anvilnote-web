import type { ComponentType } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Code2,
  Grid2x2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquareWarning,
  Pilcrow,
  Quote,
  Redo2,
  Rows3,
  Sigma,
  SquareSigma,
  Strikethrough,
  Table as TableIcon,
  Undo2,
} from "lucide-react";

/** A shortcut's chord, expressed with generic key names ("Mod" = Cmd on mac, Ctrl elsewhere). */
export type ShortcutChord = readonly ("Mod" | "Alt" | "Shift" | string)[];

export type ToolbarShortcut = {
  /** Matches an `editor.toolbar` i18n key for the button label. */
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  /** Undefined when the button has no keyboard shortcut. */
  chord?: ShortcutChord;
};

// Mirrors the buttons in tiptap-toolbar.tsx, in the same order. Chords come
// from each TipTap extension's addKeyboardShortcuts() (StarterKit v3.27),
// not guessed — see the extension source under node_modules/@tiptap/*.
export const TOOLBAR_SHORTCUTS: ToolbarShortcut[] = [
  { labelKey: "paragraph", icon: Pilcrow, chord: ["Mod", "Alt", "0"] },
  { labelKey: "heading1", icon: Heading1, chord: ["Mod", "Alt", "1"] },
  { labelKey: "heading2", icon: Heading2, chord: ["Mod", "Alt", "2"] },
  { labelKey: "heading3", icon: Heading3, chord: ["Mod", "Alt", "3"] },
  { labelKey: "bold", icon: Bold, chord: ["Mod", "B"] },
  { labelKey: "italic", icon: Italic, chord: ["Mod", "I"] },
  { labelKey: "strike", icon: Strikethrough, chord: ["Mod", "Shift", "S"] },
  { labelKey: "code", icon: Code, chord: ["Mod", "E"] },
  { labelKey: "bulletList", icon: List, chord: ["Mod", "Shift", "8"] },
  { labelKey: "orderedList", icon: ListOrdered, chord: ["Mod", "Shift", "7"] },
  { labelKey: "blockquote", icon: Quote, chord: ["Mod", "Shift", "B"] },
  { labelKey: "callout", icon: MessageSquareWarning },
  { labelKey: "codeBlock", icon: Code2, chord: ["Mod", "Alt", "C"] },
  { labelKey: "link", icon: Link2 },
  { labelKey: "table", icon: TableIcon },
  { labelKey: "image", icon: ImagePlus },
  { labelKey: "inlineMath", icon: Sigma },
  { labelKey: "blockMath", icon: SquareSigma },
  { labelKey: "undo", icon: Undo2, chord: ["Mod", "Z"] },
  { labelKey: "redo", icon: Redo2, chord: ["Mod", "Shift", "Z"] },
  { labelKey: "tableNormal", icon: Grid2x2 },
  { labelKey: "tableThreeLine", icon: Rows3 },
  { labelKey: "tableAlignLeft", icon: AlignLeft },
  { labelKey: "tableAlignCenter", icon: AlignCenter },
  { labelKey: "tableAlignRight", icon: AlignRight },
];

export type CheatSheetOs = "mac" | "windows" | "linux";

const KEY_SYMBOLS: Record<CheatSheetOs, Record<string, string>> = {
  mac: { Mod: "⌘", Alt: "⌥", Shift: "⇧" },
  windows: { Mod: "Ctrl", Alt: "Alt", Shift: "Shift" },
  linux: { Mod: "Ctrl", Alt: "Alt", Shift: "Shift" },
};

export function formatChord(chord: ShortcutChord, os: CheatSheetOs): string {
  const symbols = KEY_SYMBOLS[os];
  const parts = chord.map((key) => symbols[key] ?? key);
  return os === "mac" ? parts.join("") : parts.join("+");
}
