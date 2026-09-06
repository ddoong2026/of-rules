import { test } from 'node:test';
import assert from 'node:assert/strict';
import { farmlandArea, isInsideFarmland } from './farmland.mjs';

const points = [[0, 0], [4, 0], [4, 4], [2, 2], [0, 4], [0, 0]];
const regions = [{ isFarmland: true, points }];

test('closed concave farmland includes its edge but excludes the notch and exterior', () => {
  assert.equal(isInsideFarmland(regions, 2, 1), true);
  assert.equal(isInsideFarmland(regions, 2, 3), false);
  assert.equal(isInsideFarmland(regions, 4, 2), true);
  assert.equal(isInsideFarmland(regions, 5, 2), false);
  assert.equal(farmlandArea(points), 12);
});

test('ordinary boundaries, empty maps, and degenerate strokes do not allow farming', () => {
  assert.equal(isInsideFarmland([{ points }], 2, 1), false);
  assert.equal(isInsideFarmland([], 2, 1), false);
  assert.equal(isInsideFarmland([{ isFarmland: true, points: [[0, 0], [1, 1], [2, 2]] }], 1, 1), false);
});

test('JSON save/load and reversed drawing preserve eligibility', () => {
  assert.equal(isInsideFarmland(JSON.parse(JSON.stringify(regions)), 2, 1), true);
  assert.equal(isInsideFarmland([{ isFarmland: true, points: [...points].reverse() }], 2, 1), true);
});
