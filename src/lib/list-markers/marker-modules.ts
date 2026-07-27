// Pure, framework-free marker-rendering logic for both ordered list "modules"
// and unordered list symbols. Deliberately has zero dependency on ProseMirror
// or Zustand -- src/lib/tiptap/list-markers.ts (the decoration plugin) and
// src/lib/stores/settings-store.ts (defaults + persisted choices) both import
// from here, but this module never imports either of them back.

export type OrderedModuleId =
  | "arabic"
  | "paren-arabic"
  | "circled"
  | "alpha-lower"
  | "alpha-upper"
  | "roman-lower"
  | "roman-upper"
  | "chinese-numeral"
  | "japanese-formal"
  | "japanese-informal"
  | "korean-hangul"
  | "thai-consonant";

export const ORDERED_MODULE_IDS: readonly OrderedModuleId[] = [
  "arabic",
  "paren-arabic",
  "circled",
  "alpha-lower",
  "alpha-upper",
  "roman-lower",
  "roman-upper",
  "chinese-numeral",
  "japanese-formal",
  "japanese-informal",
  "korean-hangul",
  "thai-consonant",
];

export type UnorderedSymbol =
  | "•"
  | "◦"
  | "▪"
  | "–"
  | "■"
  | "□"
  | "▲"
  | "▼"
  | "◀"
  | "▶"
  | "◆"
  | "◇";

export const UNORDERED_SYMBOLS: readonly UnorderedSymbol[] = [
  "•",
  "◦",
  "▪",
  "–",
  "■",
  "□",
  "▲",
  "▼",
  "◀",
  "▶",
  "◆",
  "◇",
];

export type UnorderedSymbolKey =
  | "bullet"
  | "whiteBullet"
  | "blackSmallSquare"
  | "enDash"
  | "blackSquare"
  | "whiteSquare"
  | "triangleUp"
  | "triangleDown"
  | "triangleLeft"
  | "triangleRight"
  | "blackDiamond"
  | "whiteDiamond";

// i18n key per symbol (based on each glyph's own Unicode character name) --
// the settings UI shows `t(\`symbols.${UNORDERED_SYMBOL_KEYS[symbol]}\`)`
// next to the glyph so the picker isn't just a wall of unlabeled marks. A
// literal union (not plain `string`) so that template-literal key stays
// narrow enough for next-intl's typed `t()` to check against.
export const UNORDERED_SYMBOL_KEYS: Record<UnorderedSymbol, UnorderedSymbolKey> = {
  "•": "bullet",
  "◦": "whiteBullet",
  "▪": "blackSmallSquare",
  "–": "enDash",
  "■": "blackSquare",
  "□": "whiteSquare",
  "▲": "triangleUp",
  "▼": "triangleDown",
  "◀": "triangleLeft",
  "▶": "triangleRight",
  "◆": "blackDiamond",
  "◇": "whiteDiamond",
};

const CIRCLED_DIGITS = [
  "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩",
  "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳",
] as const;

// Unlimited a, b, c, ..., z, aa, ab, ... (same base-26 bijective-numeration
// algorithm the old list-markers.ts used for its alphabetic fallback level).
function alphabetic(n: number): string {
  let value = Math.max(1, n);
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(97 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

const ROMAN_TABLE: readonly [number, string][] = [
  [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"],
  [100, "c"], [90, "xc"], [50, "l"], [40, "xl"],
  [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
];

// Unlimited (in practice: any n >= 1) integer -> lowercase roman numeral.
function roman(n: number): string {
  let value = Math.max(1, Math.trunc(n));
  let out = "";
  for (const [amount, symbol] of ROMAN_TABLE) {
    while (value >= amount) {
      out += symbol;
      value -= amount;
    }
  }
  return out;
}

// Han-numeral digits (1-9) shared by both chinese-numeral and
// japanese-informal -- the two languages use the same characters for basic
// counting; only japanese-formal (daiji) substitutes a tamper-resistant set.
const HAN_DIGITS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const HAN_TEN = "十";

// Japanese daiji (大字) digits used on legal/financial documents so a
// character can't be altered into another valid one by adding strokes.
// Practical scope here is list-item counts (rarely past 99), so this only
// implements the 1-99 range: ones digits 1/2/3 get their daiji forms
// (壱/弐/参); 4-9 and the tens marker keep their everyday form, matching how
// real formal documents commonly render them (only the easily-tampered-with
// low digits and the "ten" grouping character get the daiji treatment).
const DAIJI_ONES: Record<number, string> = { 1: "壱", 2: "弐", 3: "参" };
const DAIJI_TEN = "拾";

function hanTens(n: number, ones: readonly string[], ten: string): string {
  if (n < 1) return String(n);
  if (n <= 9) return ones[n - 1];
  if (n === 10) return ten;
  const tensDigit = Math.floor(n / 10);
  const onesDigit = n % 10;
  const tensPart = tensDigit === 1 ? ten : `${ones[tensDigit - 1]}${ten}`;
  return onesDigit === 0 ? tensPart : `${tensPart}${ones[onesDigit - 1]}`;
}

function chineseNumeral(n: number): string {
  return hanTens(n, HAN_DIGITS, HAN_TEN);
}

function japaneseInformal(n: number): string {
  return hanTens(n, HAN_DIGITS, HAN_TEN);
}

function japaneseFormal(n: number): string {
  if (n < 1) return String(n);
  if (n <= 9) return DAIJI_ONES[n] ?? HAN_DIGITS[n - 1];
  if (n === 10) return DAIJI_TEN;
  const tensDigit = Math.floor(n / 10);
  const onesDigit = n % 10;
  const tensOnesChar = DAIJI_ONES[tensDigit] ?? HAN_DIGITS[tensDigit - 1];
  const tensPart = tensDigit === 1 ? DAIJI_TEN : `${tensOnesChar}${DAIJI_TEN}`;
  const onesChar = DAIJI_ONES[onesDigit] ?? HAN_DIGITS[onesDigit - 1];
  return onesDigit === 0 ? tensPart : `${tensPart}${onesChar}`;
}

// Sino-Korean counting digits (일, 이, 삼...) -- the form used for formal/
// list numbering, as opposed to native-Korean counting words (하나, 둘...).
const KOREAN_DIGITS = ["일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const KOREAN_TEN = "십";

function koreanHangul(n: number): string {
  return hanTens(n, KOREAN_DIGITS, KOREAN_TEN);
}

// 42 "actively used" Thai consonants, in traditional alphabetical order --
// the full Unicode block U+0E01-U+0E2E has 46 code points, but 2 are
// considered obsolete (Kho Khuat/Kho Khon) and 2 are vowel-like characters
// (Ru/Lu) rather than consonants; all 4 are excluded here, matching the
// conventional ก/ข/ค/ง list-marker sequence (which already skips the
// obsolete letters between ข and ค).
const THAI_CONSONANTS = [
  "ก", "ข", "ค", "ฆ", "ง", "จ", "ฉ", "ช", "ซ", "ฌ", "ญ",
  "ฎ", "ฏ", "ฐ", "ฑ", "ฒ", "ณ", "ด", "ต", "ถ", "ท", "ธ",
  "น", "บ", "ป", "ผ", "ฝ", "พ", "ฟ", "ภ", "ม", "ย", "ร",
  "ล", "ว", "ศ", "ษ", "ส", "ห", "ฬ", "อ", "ฮ",
];

// Cycles through THAI_CONSONANTS the same way alphabetic() cycles a-z:
// after the 42nd letter, repeats with a doubled prefix (ก again, but this
// simple implementation just wraps rather than combining letters, since a
// list realistically never reaches a 43rd item at a single nesting level).
function thaiConsonant(n: number): string {
  const index = Math.max(1, n) - 1;
  return THAI_CONSONANTS[index % THAI_CONSONANTS.length];
}

export function renderOrderedMarker(moduleId: OrderedModuleId, n: number): string {
  switch (moduleId) {
    case "arabic":
      return `${n}.`;
    case "paren-arabic":
      return `(${n})`;
    case "circled":
      return CIRCLED_DIGITS[n - 1] ?? `${n}.`;
    case "alpha-lower":
      return `${alphabetic(n)}.`;
    case "alpha-upper":
      return `${alphabetic(n).toUpperCase()}.`;
    case "roman-lower":
      return `${roman(n)}.`;
    case "roman-upper":
      return `${roman(n).toUpperCase()}.`;
    case "chinese-numeral":
      return `${chineseNumeral(n)}、`;
    case "japanese-formal":
      return `${japaneseFormal(n)}、`;
    case "japanese-informal":
      return `${japaneseInformal(n)}、`;
    case "korean-hangul":
      return `${koreanHangul(n)}.`;
    case "thai-consonant":
      return `${thaiConsonant(n)}.`;
  }
}
