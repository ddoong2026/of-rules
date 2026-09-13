export function placeCustomItem({ definition, selectedType, position, waterHeight, inventory, map }) {
  if (!definition?.linkedAsset || !position.every(Number.isFinite)) return 'invalid';
  // A missing flag preserves placement behavior of maps saved before this option.
  if (definition.allowWaterPlacement === false && waterHeight - position[1] > 0.001) {
    return 'water-blocked';
  }
  if (!inventory.consumeItem(selectedType, 1)) return 'missing-item';
  map.addAsset({
    id: crypto.randomUUID(),
    type: definition.linkedAsset,
    position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    customItemId: definition.id,
  });
  return 'placed';
}
