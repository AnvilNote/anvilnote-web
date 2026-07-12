import assert from "node:assert/strict";
import test from "node:test";
import { insertTrackSize, resizeTrackPair } from "./table-geometry.ts";

test("insertTrackSize keeps an untouched table evenly distributed", () => {
  assert.deepEqual(insertTrackSize([], 2, 300, 32, 2), [100, 100, 100]);
});

test("insertTrackSize preserves manual proportions around a new equal share", () => {
  assert.deepEqual(insertTrackSize([120, 80], 1, 200, 32), [80, 200 / 3, 160 / 3]);
});

test("insertTrackSize grows the total when minimum track sizes cannot fit", () => {
  assert.deepEqual(insertTrackSize([40, 40], 1, 80, 32), [32, 32, 32]);
});

test("resizeTrackPair moves a boundary without changing the pair total", () => {
  assert.deepEqual(resizeTrackPair([100, 100, 100], 0, 30, 32), [130, 70, 100]);
});

test("resizeTrackPair clamps both tracks to the minimum", () => {
  assert.deepEqual(resizeTrackPair([40, 80], 0, 100, 32), [88, 32]);
  assert.deepEqual(resizeTrackPair([40, 80], 0, -100, 32), [32, 88]);
});
