import { FRIEND_ROSTER } from "../game/friends.js?v=v55";

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function attractionVisitorIds(building, definition, visitIndex) {
  const maxVisitors = Math.max(0, Math.min(3, Number(definition?.attraction?.maxVisitors) || 0));
  if (!maxVisitors || !FRIEND_ROSTER.length || Number(visitIndex) <= 0) return [];
  const seed = stableHash(`${building?.id || "attraction"}:${Math.floor(Number(visitIndex))}`);
  const count = 1 + (seed % maxVisitors);
  const visitors = [];
  for (let index = 0; index < FRIEND_ROSTER.length * 2 && visitors.length < count; index += 1) {
    const visitor = FRIEND_ROSTER[(seed + index * 7) % FRIEND_ROSTER.length];
    if (visitor && !visitors.includes(visitor.id)) visitors.push(visitor.id);
  }
  return visitors;
}

export function currentAttractionVisitorIds(building, definition, now = Date.now()) {
  const intervalMs = Math.max(1, Number(definition?.attraction?.intervalSeconds) || 0) * 1000;
  const completedAt = Math.max(0, Number(building?.completedAt) || 0);
  const visitIndex = Math.floor(Math.max(0, Number(now) - completedAt) / intervalMs);
  return attractionVisitorIds(building, definition, visitIndex);
}
