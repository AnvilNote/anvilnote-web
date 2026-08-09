import { describe, expect, test } from "vitest";
import { parseCsvText, guessColumnMapping, isMappingComplete, applyColumnMapping } from "./csv-import";
import { ROW_SHAPE_COLUMNS } from "./row-shapes";

describe("parseCsvText", () => {
  test("splits a plain comma-separated grid", () => {
    expect(parseCsvText("category,value\nA,1\nB,2\n")).toEqual([
      ["category", "value"],
      ["A", "1"],
      ["B", "2"],
    ]);
  });

  test("handles quoted fields with embedded commas and escaped quotes", () => {
    expect(parseCsvText('category,value\n"Say ""hi"", A",1\n"has, comma",2\n')).toEqual([
      ["category", "value"],
      ['Say "hi", A', "1"],
      ["has, comma", "2"],
    ]);
  });

  test("handles CRLF line endings and a missing trailing newline", () => {
    expect(parseCsvText("x,y\r\n1,2\r\n3,4")).toEqual([
      ["x", "y"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });
});

describe("guessColumnMapping + applyColumnMapping", () => {
  test("guesses a complete mapping when headers already match column keys, case-insensitively", () => {
    const csv = parseCsvText("Category,Value\nA,10\nB,20\n");
    const guess = guessColumnMapping(csv[0], ROW_SHAPE_COLUMNS.categorical);
    expect(isMappingComplete(guess, ROW_SHAPE_COLUMNS.categorical)).toBe(true);
    expect(applyColumnMapping(csv, ROW_SHAPE_COLUMNS.categorical, guess)).toEqual([
      { category: "A", value: 10 },
      { category: "B", value: 20 },
    ]);
  });

  test("real-world CSV with unrelated header names guesses an incomplete mapping (needs manual mapping)", () => {
    // Real bug report: insurance.csv's header (age,sex,bmi,children,smoker,
    // region,charges) has no reason to contain "x"/"y"/"group" — a hard
    // name-match requirement rejected every real spreadsheet export.
    const csv = parseCsvText("age,sex,bmi,children,smoker,region,charges\n19,female,27.9,0,yes,southwest,16884.9\n");
    const guess = guessColumnMapping(csv[0], ROW_SHAPE_COLUMNS.xy);
    expect(isMappingComplete(guess, ROW_SHAPE_COLUMNS.xy)).toBe(false);
    expect(guess).toEqual({ x: null, y: null });
  });

  test("manually mapping unrelated columns onto x/y produces the expected rows", () => {
    const csv = parseCsvText("age,sex,bmi,children,smoker,region,charges\n19,female,27.9,0,yes,southwest,16884.9\n");
    // age -> x (index 0), charges -> y (index 6)
    const mapping = { x: 0, y: 6 };
    expect(applyColumnMapping(csv, ROW_SHAPE_COLUMNS.xy, mapping)).toEqual([{ x: 19, y: 16884.9 }]);
  });

  test("blank cells in a numeric column become the empty-string sentinel, not 0", () => {
    const csv = parseCsvText("category,value\nA,\n");
    const guess = guessColumnMapping(csv[0], ROW_SHAPE_COLUMNS.categorical);
    expect(applyColumnMapping(csv, ROW_SHAPE_COLUMNS.categorical, guess)).toEqual([{ category: "A", value: "" }]);
  });

  test("extra unmatched CSV columns are simply ignored once mapping is complete", () => {
    const csv = parseCsvText("category,value,extra\nA,1,ignored\n");
    const guess = guessColumnMapping(csv[0], ROW_SHAPE_COLUMNS.categorical);
    expect(isMappingComplete(guess, ROW_SHAPE_COLUMNS.categorical)).toBe(true);
    expect(applyColumnMapping(csv, ROW_SHAPE_COLUMNS.categorical, guess)).toEqual([{ category: "A", value: 1 }]);
  });

  test("single-column shape (numberList) guesses column 0 even with an unrecognized header", () => {
    const csv = parseCsvText("measurement\n1.5\n2.5\n");
    const guess = guessColumnMapping(csv[0], ROW_SHAPE_COLUMNS.numberList);
    expect(guess).toEqual({ value: 0 });
    expect(applyColumnMapping(csv, ROW_SHAPE_COLUMNS.numberList, guess)).toEqual([{ value: 1.5 }, { value: 2.5 }]);
  });

  test("skips blank lines in the data section", () => {
    const csv = parseCsvText("category,value\nA,1\n\nB,2\n");
    const guess = guessColumnMapping(csv[0], ROW_SHAPE_COLUMNS.categorical);
    expect(applyColumnMapping(csv, ROW_SHAPE_COLUMNS.categorical, guess)).toEqual([
      { category: "A", value: 1 },
      { category: "B", value: 2 },
    ]);
  });

  test("does not reuse the same CSV column for two different chart fields", () => {
    const csv = parseCsvText("value,group\n1,A\n");
    // "value" only matches one target column even if two column defs share a key elsewhere.
    const guess = guessColumnMapping(csv[0], ROW_SHAPE_COLUMNS.groupValue);
    expect(guess).toEqual({ group: 1, value: 0 });
  });
});
