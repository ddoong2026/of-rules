// Boundary points use map coordinates [x, z]. The closing point may be repeated.
export function farmlandArea(points) {
  return Math.abs(points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length];
    return sum + p[0] * next[1] - next[0] * p[1];
  }, 0)) / 2;
}

export function isInsideFarmland(boundaries, x, z) {
  return boundaries.some(({ isFarmland, points = [] }) => {
    if (!isFarmland || points.length < 3 || farmlandArea(points) < 0.5) return false;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [ax, az] = points[j];
      const [bx, bz] = points[i];
      const cross = (x - ax) * (bz - az) - (z - az) * (bx - ax);
      if (Math.abs(cross) < 1e-8 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx)
        && z >= Math.min(az, bz) && z <= Math.max(az, bz)) return true;
      if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
    }
    return inside;
  });
}
