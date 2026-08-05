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

const defaultProgress = {
  playerId: "",
  playerName: "",
  level: 1,
  xp: 0,
  coins: 20,
  streak: 0,
  completedGames: 0,
  unlockedDifficulty: "easy",
  inventory: starterInventory,
  cardCollection: [],
  totalStars: 0,
  bestTimes: {},
  rewardedRuns: [],
  achievements: [],
  achievementStats: { perfectGames: 0, speedGames: 0, alinGames: 0 },
  floors: { easy: 1, medium: 1, hard: 1 },
  playerAvatar: "",
  avatarColor: 0,
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
  const floorTotal = ["easy", "medium", "hard"]
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

const safeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : fallback;

function normalizedInventory(inventory = {}) {
  return Object.fromEntries(Object.entries({ ...starterInventory, ...inventory })
    .filter(([cardId]) => /^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(cardId))
    .map(([cardId, count]) => [cardId, Math.floor(safeNumber(count))]));
}

function normalizedProgress(saved = {}) {
  const playerName = typeof saved.playerName === "string" ? saved.playerName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 16) : "";
  const playerId = typeof saved.playerId === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(saved.playerId) ? saved.playerId : createPlayerId();
  const progress = {
    ...defaultProgress,
    ...saved,
    playerId,
    playerName,
    level: Math.max(1, Math.floor(safeNumber(saved.level, 1))),
    xp: Math.floor(safeNumber(saved.xp)),
    coins: Math.floor(safeNumber(saved.coins, 20)),
    streak: Math.floor(safeNumber(saved.streak)),
    completedGames: Math.floor(safeNumber(saved.completedGames)),
    totalStars: Math.floor(safeNumber(saved.totalStars)),
    unlockedDifficulty: ["easy", "medium", "hard"].includes(saved.unlockedDifficulty) ? saved.unlockedDifficulty : "easy",
    inventory: normalizedInventory(saved.inventory),
    cardCollection: Array.isArray(saved.cardCollection) ? saved.cardCollection.filter((cardId) => typeof cardId === "string" && /^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(cardId)).slice(0, 60) : [],
    bestTimes: saved.bestTimes || {},
    rewardedRuns: Array.isArray(saved.rewardedRuns) ? saved.rewardedRuns : [],
    achievements: Array.isArray(saved.achievements) ? [...new Set(saved.achievements.filter((id) => typeof id === "string" && /^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(id)))].slice(0, 50) : [],
    achievementStats: {
      perfectGames: Math.floor(safeNumber(saved.achievementStats?.perfectGames)),
      speedGames: Math.floor(safeNumber(saved.achievementStats?.speedGames)),
      alinGames: Math.floor(safeNumber(saved.achievementStats?.alinGames))
    },
    floors: Object.fromEntries(Object.keys(defaultProgress.floors).map((difficulty) => [difficulty, Math.max(1, Math.floor(safeNumber(saved.floors?.[difficulty], 1))) ])),
    playerAvatar: typeof saved.playerAvatar === "string" && /^[a-z_]+$/.test(saved.playerAvatar) ? saved.playerAvatar : "",
    avatarColor: Math.max(0, Math.min(7, Math.floor(safeNumber(saved.avatarColor)))),
    updatedAt: normalizeUpdatedAt(saved.updatedAt)
  };
  return progress;
}

function validSession(session) {
  const game = session?.game;
  const validGrid = (grid, allowZero) => Array.isArray(grid) && grid.length === 81 && grid.every((value) => Number.isInteger(value) && value >= (allowZero ? 0 : 1) && value <= 9);
  return Boolean(game
    && !game.completed
    && !game.failed
    && ["easy", "medium", "hard"].includes(game.difficulty)
    && validGrid(game.puzzle, true)
    && validGrid(game.solution, false)
    && validGrid(game.values, true)
    && Array.isArray(game.notes)
    && game.notes.length === 81
    && Number.isInteger(game.floor)
    && game.floor >= 1);
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
    return validSession(session) ? session : null;
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

export function rewardProgress(progress, xpReward, bonusCoins = 0, stars = 0, difficulty = "easy") {
  const next = { ...progress, floors: { ...progress.floors } };
  next.xp += xpReward;
  next.coins += Math.ceil(xpReward / 5) + bonusCoins;
  next.completedGames += 1;
  next.streak += 1;
  next.totalStars = (next.totalStars || 0) + stars;
  next.floors[difficulty] = (next.floors[difficulty] || 1) + 1;
  while (next.xp >= next.level * 100) {
    next.xp -= next.level * 100;
    next.level += 1;
    next.coins += 25;
  }
  if (next.completedGames >= 2) next.unlockedDifficulty = "medium";
  if (next.completedGames >= 5) next.unlockedDifficulty = "hard";
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
  if (payload.session?.game && !validSession(payload.session)) throw new Error("存檔中的關卡資料不完整");
  const session = payload.session?.game && validSession(payload.session) ? payload.session : null;
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
