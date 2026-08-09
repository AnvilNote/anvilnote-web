import { describe, expect, test } from "vitest";
import { containsMathSyntax, parsePastedMathText } from "./paste-math";

describe("containsMathSyntax", () => {
  test("detects inline math", () => {
    expect(containsMathSyntax("The answer is $x^2 + 1$.")).toBe(true);
  });

  test("detects block math", () => {
    expect(containsMathSyntax("$$\\int_0^1 x\\,dx$$")).toBe(true);
  });

  test("detects \\(...\\) inline math", () => {
    expect(containsMathSyntax("The answer is \\(x^2 + 1\\).")).toBe(true);
  });

  test("detects \\[...\\] block math", () => {
    expect(containsMathSyntax("\\[F = ma\\]")).toBe(true);
  });

  test("detects a bare [...] block alone on its own paragraph (stripped-backslash case)", () => {
    // Regression: this delimiter style was added to parsePastedMathText's
    // own BLOCK_MATH_ONLY regex but NOT mirrored here when containsMathSyntax
    // was still a separate hand-maintained regex — the paste handler's own
    // early-return guard (tiptap-editor.tsx) kept calling this function
    // FIRST and bailing out before parsePastedMathText ever ran, so the
    // parser support had zero real effect. containsMathSyntax is now
    // derived directly from parsePastedMathText's output specifically so
    // this can't happen again.
    expect(containsMathSyntax("[\nU(x,y)=x^{1/2}y^{1/2},\n]")).toBe(true);
  });

  test("does NOT trigger for an ordinary bracketed citation inline in prose", () => {
    expect(containsMathSyntax("See the appendix [1] for details.")).toBe(false);
  });

  test("plain text without math returns false", () => {
    expect(containsMathSyntax("Just a normal AI reply, no formulas here.")).toBe(false);
  });
});

describe("parsePastedMathText", () => {
  test("converts an inline $...$ span into an inlineMath node inside its paragraph", () => {
    const blocks = parsePastedMathText("The answer is $x^2 + 1$, simplified.");
    expect(blocks).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "The answer is " },
          { type: "inlineMath", attrs: { latex: "x^2 + 1" } },
          { type: "text", text: ", simplified." },
        ],
      },
    ]);
  });

  test("a paragraph that is entirely $$...$$ becomes a blockMath node", () => {
    const blocks = parsePastedMathText("$$\\int_0^1 x\\,dx = \\frac{1}{2}$$");
    expect(blocks).toEqual([
      { type: "blockMath", attrs: { latex: "\\int_0^1 x\\,dx = \\frac{1}{2}" } },
    ]);
  });

  test("multiple paragraphs separated by a blank line stay separate blocks", () => {
    const blocks = parsePastedMathText(
      "First paragraph with $a$.\n\n$$b^2$$\n\nThird paragraph, no math.",
    );
    expect(blocks).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "First paragraph with " },
          { type: "inlineMath", attrs: { latex: "a" } },
          { type: "text", text: "." },
        ],
      },
      { type: "blockMath", attrs: { latex: "b^2" } },
      { type: "paragraph", content: [{ type: "text", text: "Third paragraph, no math." }] },
    ]);
  });

  test("ordinary markdown-looking syntax stays literal text, not reinterpreted", () => {
    const blocks = parsePastedMathText("**bold** and # heading with $x$ math");
    expect(blocks).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "**bold** and # heading with " },
          { type: "inlineMath", attrs: { latex: "x" } },
          { type: "text", text: " math" },
        ],
      },
    ]);
  });

  test("a stray unmatched $ (e.g. currency) with no closing $ stays literal", () => {
    const blocks = parsePastedMathText("It costs $5 total.");
    expect(blocks).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "It costs $5 total." }] },
    ]);
  });

  test("\\(...\\) inline math converts the same as $...$", () => {
    const blocks = parsePastedMathText("The answer is \\(x^2 + 1\\), simplified.");
    expect(blocks).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "The answer is " },
          { type: "inlineMath", attrs: { latex: "x^2 + 1" } },
          { type: "text", text: ", simplified." },
        ],
      },
    ]);
  });

  test("a paragraph that is entirely \\[...\\] becomes a blockMath node", () => {
    const blocks = parsePastedMathText("\\[F = ma\\]");
    expect(blocks).toEqual([{ type: "blockMath", attrs: { latex: "F = ma" } }]);
  });

  test("a paragraph that is entirely bare [...] becomes a blockMath node (stripped-backslash case)", () => {
    // Reproduces a real ticket: some external AI tool's own markdown
    // pipeline treats "\[" as CommonMark's backslash-escape of a literal
    // "[" and drops the backslash on serialization, so the pasted text has
    // bare "[" / "]" instead of "\[" / "\]".
    const blocks = parsePastedMathText("[\nU(x,y)=x^{1/2}y^{1/2},\n]");
    expect(blocks).toEqual([
      { type: "blockMath", attrs: { latex: "U(x,y)=x^{1/2}y^{1/2}," } },
    ]);
  });

  test("bare [ ] does NOT trigger for an ordinary bracketed citation inline in prose", () => {
    const blocks = parsePastedMathText("See the appendix [1] for details.");
    expect(blocks).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "See the appendix [1] for details." }] },
    ]);
  });
});
