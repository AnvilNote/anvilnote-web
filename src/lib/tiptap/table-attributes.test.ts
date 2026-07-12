import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCellBoolean,
  normalizeCellColor,
  normalizeCellInset,
  normalizeCellVerticalAlign,
} from "./table-attributes.ts";

test("normalizeCellColor accepts CSS hex colors only", () => {
  assert.equal(normalizeCellColor("#aabbcc"), "#aabbcc");
  assert.equal(normalizeCellColor("#ABC"), "#ABC");
  assert.equal(normalizeCellColor("red"), null);
  assert.equal(normalizeCellColor("red; color: blue"), null);
});

test("normalizeCellInset accepts finite non-negative Typst-compatible lengths", () => {
  assert.equal(normalizeCellInset("8pt"), "8pt");
  assert.equal(normalizeCellInset("1.5em"), "1.5em");
  assert.equal(normalizeCellInset("-1pt"), null);
  assert.equal(normalizeCellInset("calc(1px)"), null);
});

test("normalizeCellBoolean accepts booleans and serialized booleans", () => {
  assert.equal(normalizeCellBoolean(true), true);
  assert.equal(normalizeCellBoolean("false"), false);
  assert.equal(normalizeCellBoolean("yes"), null);
});

test("normalizeCellVerticalAlign accepts only table-safe values", () => {
  assert.equal(normalizeCellVerticalAlign("middle"), "middle");
  assert.equal(normalizeCellVerticalAlign("top"), "top");
  assert.equal(normalizeCellVerticalAlign("baseline"), null);
});
