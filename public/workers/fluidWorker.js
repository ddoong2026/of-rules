let timer = null;
let heights = null;
let waterGrid = null;
let gridSize = 50;

self.onmessage = function (e) {
  const data = e.data;
  heights = data.heights;
  gridSize = data.gridSize;
  const vertexCount = (gridSize + 1) * (gridSize + 1);

  if (!waterGrid || waterGrid.length !== vertexCount) {
    waterGrid = new Float32Array(vertexCount).fill(0);
  }

  // Add water from sources
  const halfSize = gridSize / 2;
  data.waterSources.forEach(source => {
    // Map -25..25 to 0..50
    const xIdx = Math.round(source.x + halfSize);
    const yIdx = Math.round(source.z + halfSize);
    if (xIdx >= 0 && xIdx <= gridSize && yIdx >= 0 && yIdx <= gridSize) {
      const idx = yIdx * (gridSize + 1) + xIdx;
      waterGrid[idx] += 0.5; // Add water continuously
    }
  });

  if (!timer) {
    timer = setInterval(simulateStep, 100);
  }
};

function simulateStep() {
  if (!heights || !waterGrid) return;

  const nextWater = new Float32Array(waterGrid);
  const rowSize = gridSize + 1;

  // Simple cellular automata for fluid flow
  for (let y = 1; y < gridSize; y++) {
    for (let x = 1; x < gridSize; x++) {
      const i = y * rowSize + x;
      if (waterGrid[i] <= 0) continue;

      const currentTotalHeight = heights[i] + waterGrid[i];
      let maxDiff = 0;
      let targetIdx = -1;

      // Check 4 neighbors
      const neighbors = [
        i - rowSize, // up
        i + rowSize, // down
        i - 1,       // left
        i + 1        // right
      ];

      for (let n of neighbors) {
        const neighborTotal = heights[n] + waterGrid[n];
        const diff = currentTotalHeight - neighborTotal;
        if (diff > maxDiff) {
          maxDiff = diff;
          targetIdx = n;
        }
      }

      // Move some water to the lowest neighbor
      if (targetIdx !== -1 && maxDiff > 0) {
        const flow = Math.min(waterGrid[i], maxDiff / 2.5); // Flow rate
        nextWater[i] -= flow;
        nextWater[targetIdx] += flow;
      }
    }
  }

  waterGrid = nextWater;

  // Extract water positions to render
  const waterPositions = [];
  const halfSize = gridSize / 2;
  
  for (let y = 0; y <= gridSize; y++) {
    for (let x = 0; x <= gridSize; x++) {
      const i = y * rowSize + x;
      if (waterGrid[i] > 0.05) { // Threshold to render
        waterPositions.push({
          x: x - halfSize,
          y: heights[i] + (waterGrid[i] / 2),
          z: y - halfSize,
          amount: waterGrid[i]
        });
      }
    }
  }

  self.postMessage({ waterPositions });
}
