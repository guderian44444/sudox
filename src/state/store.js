import { normalizeSession } from "../game/flow.js?v=v53";
import { mergeIslandStates } from "../island/model.js?v=v53";

const STORAGE_KEY = "sudox-progress-v3";
const SESSION_KEY = "sudox-session-v3";
const LEGACY_STORAGE_KEYS = ["sudox-progress-v2", "sudox-progress-v1"];

function createPlayerId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 3) | 8).toString(16);
  });
}

const starterInventory = {
  heartPotion: 1,
  shield: 1,
  candidateLens: 0,
  smartHint: 0,
  hourglass: 0,
  revive: 0,
  luckyStar: 0,
  treasureKey: 0
};

// Difficulties are free-choice from the first game (easy / medium / hard).
// Legacy saves may still contain unlockedDifficulty; it is stripped on normalize/save.
const defaultProgress = {
  playerId: "",
  playerName: "",
  level: 1,
  xp: 0,
  coins: 20,
  streak: 0,
  completedGames: 0,
  inventory: starterInventory,
  cardCollection: [],
  totalStars: 0,
  bestTimes: {},
  rewardedRuns: [],
  achievements: [],
  achievementStats: { perfectGames: 0, speedGames: 0, alinGames: 0 },
  floors: { easy: 1, medium: 1, hard: 1, alin: 1 },
  floorModelVersion: 2,
  playerAvatar: "",
  avatarColor: 0,
  island: null,
  updatedAt: ""
};

function normalizeUpdatedAt(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

export function saveTimestampMs(progress, fallbackExportedAt = "") {
  const primary = normalizeUpdatedAt(progress?.updatedAt);
  if (primary) return Date.parse(primary);
  const fallback = normalizeUpdatedAt(fallbackExportedAt);
  return fallback ? Date.parse(fallback) : 0;
}

function progressRank(progress = {}) {
  const floors = progress.floors || {};
  const floorTotal = ["easy", "medium", "hard", "alin"]
    .reduce((total, difficulty) => total + Math.max(0, Number(floors[difficulty]) || 0), 0);
  return Math.max(0, Number(progress.completedGames) || 0) * 1000
    + Math.max(0, Number(progress.totalStars) || 0) * 10
    + Math.max(0, Number(progress.level) || 0)
    + floorTotal;
}

/**
 * Decide which save should win when hydrating cloud over local.
 * Returns "cloud" | "local". Equal or unknown timestamps keep local to avoid clobbering.
 */
export function preferSaveSide(localProgress, cloudProgress, {
  localExportedAt = "",
  cloudExportedAt = "",
  localHasSession = false,
  cloudHasSession = false
} = {}) {
  const localMs = saveTimestampMs(localProgress, localExportedAt);
  const cloudMs = saveTimestampMs(cloudProgress, cloudExportedAt);

  if (localMs && cloudMs) {
    if (cloudMs > localMs) return "cloud";
    return "local";
  }

  if (localHasSession && !cloudHasSession) return "local";
  if (cloudHasSession && !localHasSession) return "cloud";

  const localScore = progressRank(localProgress);
  const cloudScore = progressRank(cloudProgress);
  if (cloudScore > localScore) return "cloud";
  if (localScore > cloudScore) return "local";

  if (cloudMs && !localMs) return "cloud";
  return "local";
}

/**
 * Never let floors / lifetime counters go backwards when merging two saves.
 * `primary` supplies spendable balances and mutable world state; only lifetime
 * counters use high-water marks. Taking the maximum coin balance would restore
 * coins that were already spent on another device.
 */
export function mergeProgressHighWater(primary, secondary = {}) {
  const base = primary && typeof primary === "object" ? primary : {};
  const other = secondary && typeof secondary === "object" ? secondary : {};
  const floorKeys = Object.keys(defaultProgress.floors);
  const floors = Object.fromEntries(floorKeys.map((difficulty) => [
    difficulty,
    Math.max(
      1,
      Math.floor(Number(base.floors?.[difficulty]) || 1),
      Math.floor(Number(other.floors?.[difficulty]) || 1)
    )
  ]));
  return {
    ...base,
    floors,
    completedGames: Math.max(0, Math.floor(Number(base.completedGames) || 0), Math.floor(Number(other.completedGames) || 0)),
    totalStars: Math.max(0, Math.floor(Number(base.totalStars) || 0), Math.floor(Number(other.totalStars) || 0)),
    level: Math.max(1, Math.floor(Number(base.level) || 1), Math.floor(Number(other.level) || 1)),
    coins: Math.max(0, Math.floor(Number(base.coins) || 0)),
    island: mergeIslandStates(base.island, other.island)
  };
}

/**
 * Leaderboard stores the highest COMPLETED floor.
 * Local `floors[difficulty]` is the NEXT floor to play, so it must be >= completed + 1.
 */
export function nextFloorFromCompleted(completedFloor) {
  return Math.max(1, Math.floor(Number(completedFloor) || 0) + 1);
}

export function raiseFloorProgress(progress, difficulty, nextFloor) {
  const key = difficulty;
  if (!key || defaultProgress.floors[key] == null) return progress;
  const target = Math.max(1, Math.floor(Number(nextFloor) || 1));
  const current = Math.max(1, Math.floor(Number(progress?.floors?.[key]) || 1));
  if (current >= target) return progress;
  return {
    ...progress,
    floors: { ...progress.floors, [key]: target }
  };
}

/** Return whether an active run is older than the saved next floor. */
export function sessionFloorBehindProgress(progress, game, alinMode = false) {
  const difficulty = alinMode ? "alin" : game?.difficulty;
  if (!difficulty || defaultProgress.floors[difficulty] == null) return false;
  const nextFloor = Math.max(1, Math.floor(Number(progress?.floors?.[difficulty]) || 1));
  const activeFloor = Math.max(1, Math.floor(Number(game?.floor) || 1));
  return activeFloor < nextFloor;
}

const safeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : fallback;

function normalizedInventory(inventory = {}) {
  return Object.fromEntries(Object.entries({ ...starterInventory, ...inventory })
    .filter(([cardId]) => /^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(cardId))
    .map(([cardId, count]) => [cardId, Math.floor(safeNumber(count))]));
}

function normalizedProgress(saved = {}) {
  // Drop legacy unlock gate — product rule is free difficulty choice from day one.
  const { unlockedDifficulty: _legacyUnlockedDifficulty, ...safeSaved } = saved && typeof saved === "object" ? saved : {};
  const playerName = typeof safeSaved.playerName === "string" ? safeSaved.playerName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 16) : "";
  const playerId = typeof safeSaved.playerId === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(safeSaved.playerId) ? safeSaved.playerId : createPlayerId();
  const progress = {
    ...defaultProgress,
    ...safeSaved,
    playerId,
    playerName,
    level: Math.max(1, Math.floor(safeNumber(safeSaved.level, 1))),
    xp: Math.floor(safeNumber(safeSaved.xp)),
    coins: Math.floor(safeNumber(safeSaved.coins, 20)),
    streak: Math.floor(safeNumber(safeSaved.streak)),
    completedGames: Math.floor(safeNumber(safeSaved.completedGames)),
    totalStars: Math.floor(safeNumber(safeSaved.totalStars)),
    inventory: normalizedInventory(safeSaved.inventory),
    cardCollection: Array.isArray(safeSaved.cardCollection) ? safeSaved.cardCollection.filter((cardId) => typeof cardId === "string" && /^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(cardId)).slice(0, 60) : [],
    bestTimes: safeSaved.bestTimes || {},
    rewardedRuns: Array.isArray(safeSaved.rewardedRuns) ? safeSaved.rewardedRuns : [],
    achievements: Array.isArray(safeSaved.achievements) ? [...new Set(safeSaved.achievements.filter((id) => typeof id === "string" && /^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(id)))].slice(0, 50) : [],
    achievementStats: {
      perfectGames: Math.floor(safeNumber(safeSaved.achievementStats?.perfectGames)),
      speedGames: Math.floor(safeNumber(safeSaved.achievementStats?.speedGames)),
      alinGames: Math.floor(safeNumber(safeSaved.achievementStats?.alinGames))
    },
    floors: Object.fromEntries(Object.keys(defaultProgress.floors).map((difficulty) => [difficulty, Math.max(1, Math.floor(safeNumber(safeSaved.floors?.[difficulty], 1))) ])),
    floorModelVersion: safeSaved.floorModelVersion === 1
      ? 1
      : safeSaved.floorModelVersion === 2
        ? 2
        : safeSaved.floors && safeSaved.floors.alin == null ? 1 : 2,
    playerAvatar: (() => {
      if (typeof safeSaved.playerAvatar !== "string" || !/^[a-z_]+$/.test(safeSaved.playerAvatar)) return "";
      // Legacy renames: wild rabbit slot → horse, panda face → sheep.
      if (safeSaved.playerAvatar === "bunny") return "horse";
      if (safeSaved.playerAvatar === "panda_face") return "sheep";
      return safeSaved.playerAvatar;
    })(),
    avatarColor: Math.max(0, Math.min(7, Math.floor(safeNumber(safeSaved.avatarColor)))),
    island: safeSaved.island && typeof safeSaved.island === "object" && !Array.isArray(safeSaved.island) ? safeSaved.island : null,
    updatedAt: normalizeUpdatedAt(safeSaved.updatedAt)
  };
  delete progress.unlockedDifficulty;
  return progress;
}

function validSession(session) {
  return Boolean(normalizeSession(session));
}

export function loadProgress() {
  try {
    const legacy = LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || legacy || "null") || {};
    return normalizedProgress(saved);
  } catch {
    return normalizedProgress();
  }
}

export function saveProgress(progress, { touch = true } = {}) {
  if (progress && "unlockedDifficulty" in progress) delete progress.unlockedDifficulty;
  if (touch || !normalizeUpdatedAt(progress.updatedAt)) {
    progress.updatedAt = new Date().toISOString();
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  return progress;
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return normalizeSession(session);
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function addCard(progress, cardId) {
  const next = { ...progress, inventory: { ...progress.inventory }, cardCollection: [...progress.cardCollection] };
  next.inventory[cardId] = (next.inventory[cardId] || 0) + 1;
  if (!next.cardCollection.includes(cardId)) next.cardCollection.push(cardId);
  saveProgress(next);
  return next;
}

export function consumeCard(progress, cardId) {
  if (!progress.inventory[cardId]) return progress;
  const next = { ...progress, inventory: { ...progress.inventory, [cardId]: progress.inventory[cardId] - 1 } };
  saveProgress(next);
  return next;
}

export function spendCoins(progress, amount) {
  if (progress.coins < amount) return progress;
  const next = { ...progress, coins: progress.coins - amount };
  saveProgress(next);
  return next;
}

/**
 * @param {object} progress
 * @param {number} xpReward
 * @param {number} [bonusCoins]
 * @param {number} [stars]
 * @param {string} [difficulty]
 * @param {number | null} [completedFloor] floor just cleared — next floor must be >= completed + 1
 */
export function rewardProgress(progress, xpReward, bonusCoins = 0, stars = 0, difficulty = "easy", completedFloor = null) {
  const next = { ...progress, floors: { ...progress.floors } };
  next.xp += xpReward;
  next.coins += Math.ceil(xpReward / 5) + bonusCoins;
  next.completedGames += 1;
  next.streak += 1;
  next.totalStars = (next.totalStars || 0) + stars;
  // floors[difficulty] = NEXT floor to play (never regress; honor completed floor).
  const key = defaultProgress.floors[difficulty] != null ? difficulty : "easy";
  const current = Math.max(1, Math.floor(Number(next.floors[key]) || 1));
  const hasCompletedFloor = completedFloor != null && Number.isFinite(Number(completedFloor));
  const fromCompleted = hasCompletedFloor ? Math.floor(Number(completedFloor)) + 1 : 0;
  // A stale/replayed lower session must never increment an already-higher next-floor record.
  next.floors[key] = hasCompletedFloor
    ? Math.max(current, fromCompleted, 1)
    : Math.max(current + 1, 1);
  while (next.xp >= next.level * 100) {
    next.xp -= next.level * 100;
    next.level += 1;
    next.coins += 25;
  }
  // No difficulty unlock gate — medium/hard stay available from the first session.
  saveProgress(next);
  return next;
}

function checksum(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function encodeText(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeText(encoded) {
  const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

export function exportSaveCode(progress, session = null) {
  if (!normalizeUpdatedAt(progress?.updatedAt)) {
    progress.updatedAt = new Date().toISOString();
  }
  const exportedAt = progress.updatedAt;
  const data = JSON.stringify({ version: 3, progress, session, exportedAt });
  return `SUDOX3.${checksum(data)}.${encodeText(data)}`;
}

/** Parse a save code without writing localStorage (safe for cloud comparison). */
export function parseSaveCode(code) {
  const [prefix, expectedChecksum, encoded] = String(code ?? "").trim().split(".");
  if (prefix !== "SUDOX3" || !expectedChecksum || !encoded || encoded.length > 300000) throw new Error("存檔碼格式不正確");
  const data = decodeText(encoded);
  if (checksum(data) !== expectedChecksum) throw new Error("存檔碼已損壞或不完整");
  const payload = JSON.parse(data);
  if (payload.version !== 3 || !payload.progress) throw new Error("不支援這個存檔版本");
  const progress = normalizedProgress(payload.progress);
  if (!progress.updatedAt) progress.updatedAt = normalizeUpdatedAt(payload.exportedAt);
  let session = null;
  if (payload.session?.game) {
    session = normalizeSession(payload.session);
    if (!session) throw new Error("存檔中的關卡資料不完整");
  }
  return {
    progress,
    session,
    exportedAt: normalizeUpdatedAt(payload.exportedAt) || progress.updatedAt || ""
  };
}

/**
 * Apply a save code to localStorage.
 * @param {string} code
 * @param {{ touch?: boolean }} [options] touch=true marks this device as newest (manual import / explicit cloud load).
 */
export function importSaveCode(code, { touch = true } = {}) {
  const parsed = parseSaveCode(code);
  saveProgress(parsed.progress, { touch });
  if (parsed.session) saveSession(parsed.session);
  else clearSession();
  return { progress: parsed.progress, session: loadSession(), exportedAt: parsed.exportedAt };
}
