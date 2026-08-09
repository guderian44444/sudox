export const HEX_WIDTH = 64;
export const HEX_HEIGHT = 56;

export const axialKey = (q, r) => `${Math.trunc(Number(q) || 0)},${Math.trunc(Number(r) || 0)}`;

export function parseAxialKey(key) {
  const match = /^(-?\d+),(-?\d+)$/.exec(String(key || ""));
  return match ? { q: Number(match[1]), r: Number(match[2]) } : null;
}

export function axialDistance(a, b = { q: 0, r: 0 }) {
  const aq = Math.trunc(Number(a?.q) || 0);
  const ar = Math.trunc(Number(a?.r) || 0);
  const bq = Math.trunc(Number(b?.q) || 0);
  const br = Math.trunc(Number(b?.r) || 0);
  return (Math.abs(aq - bq) + Math.abs(ar - br) + Math.abs((-aq - ar) - (-bq - br))) / 2;
}

export const HEX_DIRECTIONS = Object.freeze([
  Object.freeze({ q: 1, r: 0 }),
  Object.freeze({ q: 1, r: -1 }),
  Object.freeze({ q: 0, r: -1 }),
  Object.freeze({ q: -1, r: 0 }),
  Object.freeze({ q: -1, r: 1 }),
  Object.freeze({ q: 0, r: 1 })
]);

export function axialNeighbors(q, r) {
  return HEX_DIRECTIONS.map((direction) => ({ q: q + direction.q, r: r + direction.r }));
}

export function hexRange(radius) {
  const safeRadius = Math.max(0, Math.floor(Number(radius) || 0));
  const cells = [];
  for (let q = -safeRadius; q <= safeRadius; q += 1) {
    const minR = Math.max(-safeRadius, -q - safeRadius);
    const maxR = Math.min(safeRadius, -q + safeRadius);
    for (let r = minR; r <= maxR; r += 1) cells.push({ q, r });
  }
  return cells;
}

export function axialToPixel(q, r) {
  return {
    x: HEX_WIDTH * 0.75 * q,
    y: HEX_HEIGHT * (r + q / 2)
  };
}

export function rotateAxial(cell, turns = 0) {
  let x = Math.trunc(Number(cell?.q) || 0);
  let z = Math.trunc(Number(cell?.r) || 0);
  let y = -x - z;
  const count = ((Math.trunc(Number(turns) || 0) % 6) + 6) % 6;
  for (let index = 0; index < count; index += 1) {
    [x, y, z] = [-z, -x, -y];
  }
  return { q: x, r: z };
}

export function footprintCells(anchor, footprint = [{ q: 0, r: 0 }], orientation = 0) {
  return footprint.map((offset) => {
    const rotated = rotateAxial(offset, orientation);
    return { q: anchor.q + rotated.q, r: anchor.r + rotated.r };
  });
}

export function mapPixelBounds(cells) {
  const positions = cells.map((cell) => ({ ...cell, ...axialToPixel(cell.q, cell.r) }));
  const minX = Math.min(...positions.map((cell) => cell.x));
  const maxX = Math.max(...positions.map((cell) => cell.x));
  const minY = Math.min(...positions.map((cell) => cell.y));
  const maxY = Math.max(...positions.map((cell) => cell.y));
  const padding = 24;
  return {
    width: Math.ceil(maxX - minX + HEX_WIDTH + padding * 2),
    height: Math.ceil(maxY - minY + HEX_HEIGHT + padding * 2),
    offsetX: padding - minX,
    offsetY: padding - minY
  };
}
