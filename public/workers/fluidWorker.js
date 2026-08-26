let timer = null;
let heights = null;
let waterGrid = null;
let waterSources = [];
let gridSize = 50;

self.onmessage = function (e) {
  const data = e.data;
  heights = data.heights;
  gridSize = data.gridSize;
  waterSources = data.waterSources;
  
  const vertexCount = (gridSize + 1) * (gridSize + 1);

  if (!waterGrid || waterGrid.length !== vertexCount) {
    waterGrid = new Float32Array(vertexCount).fill(0);
  }

  if (!timer) {
    timer = setInterval(simulateStep, 50); // Make it slightly faster
  }
};

function simulateStep() {
  if (!heights || !waterGrid) return;

  const rowSize = gridSize + 1;
  const halfSize = gridSize / 2;

  // 1. Add water continuously from sources
  waterSources.forEach(source => {
    const xIdx = Math.round(source.x + halfSize);
    const yIdx = Math.round(source.z + halfSize);
    if (xIdx >= 0 && xIdx <= gridSize && yIdx >= 0 && yIdx <= gridSize) {
      const idx = yIdx * rowSize + xIdx;
      waterGrid[idx] += 0.2; // Add a bit of water every tick
    }
  });

  const nextWater = new Float32Array(waterGrid);

  // 2. Simulate flow
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
      if (targetIdx !== -1 && maxDiff > 0.05) {
        const flow = Math.min(waterGrid[i], maxDiff / 4); // Smooth flow rate
        nextWater[i] -= flow;
        nextWater[targetIdx] += flow;
      }
      
      // Slight evaporation to prevent infinite flooding over time
      nextWater[i] *= 0.99;
    }
  }

  // Edge sinks (water that reaches the edge disappears)
  for (let y = 0; y <= gridSize; y++) {
    for (let x = 0; x <= gridSize; x++) {
      if (x === 0 || x === gridSize || y === 0 || y === gridSize) {
        const i = y * rowSize + x;
        nextWater[i] = 0;
      }
    }
  }

  waterGrid = nextWater;

  // 3. Extract positions to render
  const waterPositions = [];
  
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
