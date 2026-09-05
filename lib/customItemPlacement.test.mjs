import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeCustomItem } from './customItemPlacement.mjs';

function attempt(allowWaterPlacement, ground, water, stock = 2) {
  let count = stock;
  const assets = [];
  const definition = JSON.parse(JSON.stringify({ id: 'item1', linkedAsset: 'rock', allowWaterPlacement }));
  const result = placeCustomItem({
    definition, selectedType: 'item1_identified', position: [0, ground, 0], waterHeight: water,
    inventory: { consumeItem(type, amount) {
      assert.equal(type, 'item1_identified');
      if (count < amount) return false;
      count -= amount;
      return true;
    } },
    map: { addAsset: asset => assets.push(asset) },
  });
  return { result, count, assets };
}

test('water restriction blocks placement without consuming inventory', () => {
  assert.deepEqual(attempt(false, -1, -0.2), { result: 'water-blocked', count: 2, assets: [] });
  assert.equal(attempt(false, 3, 4).result, 'water-blocked');
});
test('allowed and old items can be placed in water after JSON save/load', () => {
  for (const flag of [true, undefined]) {
    const { result, count, assets } = attempt(flag, -1, -0.2);
    assert.equal(result, 'placed');
    assert.equal(count, 1);
    assert.equal(assets[0].customItemId, 'item1');
  }
});
test('restricted items remain placeable on dry land and at the water surface', () => {
  assert.equal(attempt(false, 0, -0.2).result, 'placed');
  assert.equal(attempt(false, -0.2, -0.2).result, 'placed');
});
test('no item means no asset can be created', () => {
  assert.deepEqual(attempt(true, -1, -0.2, 0), { result: 'missing-item', count: 0, assets: [] });
});
