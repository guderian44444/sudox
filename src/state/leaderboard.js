import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config.js";
import { loadCloudPin, validCloudPin } from "./cloud.js";

const QUEUE_KEY = "sudox-score-queue-v1";
const difficulties = new Set(["easy", "medium", "hard", "alin"]);

export function leaderboardConfigured() {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) && SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");
}

function headers(extra = {}) {
  return { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json", ...extra };
}

function loadQueue() {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(queue) ? queue.slice(-30) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-30)));
}

/** Strip any legacy PIN field so the offline queue never stores credentials. */
function sanitizeQueuedScore(score) {
  const {
    p_player_id,
    p_player_name,
    p_difficulty,
    p_floor,
    p_score,
    p_elapsed_seconds,
    p_mistakes,
    p_stars,
    p_player_avatar,
    p_avatar_color
  } = score || {};
  return {
    p_player_id,
    p_player_name,
    p_difficulty,
    p_floor,
    p_score,
    p_elapsed_seconds,
    p_mistakes,
    p_stars,
    p_player_avatar: p_player_avatar || null,
    p_avatar_color: p_avatar_color != null ? p_avatar_color : 0
  };
}

export function pendingScoreCount() {
  return loadQueue().length;
}

export function normalizeLeaderboardTaunt(value) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 48);
}

export function buildScore(progress, game, alinMode = false) {
  const score = game.floor * 10000 + game.stars * 1000 + Math.max(0, 2000 - game.elapsed) - game.mistakes * 100;
  return sanitizeQueuedScore({
    p_player_id: progress.playerId,
    p_player_name: progress.playerName,
    p_difficulty: alinMode ? "alin" : game.difficulty,
    p_floor: game.floor,
    p_score: Math.max(0, Math.round(score)),
    p_elapsed_seconds: Math.max(0, Math.round(game.elapsed)),
    p_mistakes: Math.max(0, Math.round(game.mistakes)),
    p_stars: Math.max(1, Math.min(3, Math.round(game.stars))),
    p_player_avatar: progress.playerAvatar || null,
    p_avatar_color: progress.avatarColor != null ? progress.avatarColor : 0
  });
}

async function sendScore(score) {
  const pin = loadCloudPin();
  if (!validCloudPin(pin)) throw new Error("需要 4 位數家庭 PIN 才能上傳成績");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_leaderboard_score`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ ...sanitizeQueuedScore(score), p_pin: pin })
  });
  if (!response.ok) {
    const detail = await response.text();
    if (/Invalid cloud PIN|P0001/i.test(detail)) throw new Error("家庭 PIN 驗證失敗，無法上傳成績");
    throw new Error(`排行榜寫入失敗 (${response.status})`);
  }
}

export async function flushPendingScores() {
  if (!leaderboardConfigured() || !navigator.onLine) return { sent: 0, pending: pendingScoreCount() };
  const queue = loadQueue();
  let sent = 0;
  while (queue.length) {
    try {
      await sendScore(queue[0]);
      queue.shift();
      sent += 1;
      saveQueue(queue);
    } catch {
      break;
    }
  }
  return { sent, pending: queue.length };
}

export async function queueLeaderboardScore(score) {
  const clean = sanitizeQueuedScore(score);
  const queue = loadQueue();
  const existing = queue.findIndex((item) => item.p_player_id === clean.p_player_id && item.p_difficulty === clean.p_difficulty);
  if (existing >= 0) {
    if (clean.p_floor > queue[existing].p_floor || clean.p_score > queue[existing].p_score) queue[existing] = clean;
  } else queue.push(clean);
  saveQueue(queue);
  return flushPendingScores();
}

export async function fetchLeaderboard(difficulty = "easy") {
  if (!leaderboardConfigured()) throw new Error("排行榜尚未連接資料庫");
  if (!difficulties.has(difficulty)) throw new Error("排行榜難度不正確");
  const query = new URLSearchParams({
    select: "player_id,player_name,difficulty,floor,score,elapsed_seconds,mistakes,stars,taunt,player_avatar,avatar_color,updated_at",
    difficulty: `eq.${difficulty}`,
    order: "floor.desc,score.desc",
    limit: "50"
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard_scores?${query}`, { headers: headers() });
  if (!response.ok) throw new Error(`無法讀取排行榜 (${response.status})`);
  return response.json();
}

export async function updateLeaderboardTaunt({ playerId, pin, taunt }) {
  if (!leaderboardConfigured()) throw new Error("排行榜尚未連接資料庫");
  const cleanTaunt = normalizeLeaderboardTaunt(taunt);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_leaderboard_taunt`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ p_player_id: playerId, p_pin: pin, p_taunt: cleanTaunt })
  });
  if (!response.ok) throw new Error(response.status === 400 ? "家庭 PIN 驗證失敗" : `嗆聲更新失敗 (${response.status})`);
  return cleanTaunt;
}

export async function updateLeaderboardAvatar({ playerId, pin, avatar, color }) {
  if (!leaderboardConfigured() || !playerId || !/^\d{4}$/.test(String(pin || ""))) return;
  const cleanAvatar = typeof avatar === "string" && /^[a-z_]+$/.test(avatar) ? avatar : null;
  if (!cleanAvatar) return;
  const cleanColor = Math.max(0, Math.min(7, Math.floor(Number(color) || 0)));
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_leaderboard_avatar`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ p_player_id: playerId, p_pin: pin, p_player_avatar: cleanAvatar, p_avatar_color: cleanColor })
  });
  if (!response.ok) {
    const detail = await response.text();
    if (/Invalid cloud PIN|P0001/i.test(detail)) throw new Error("家庭 PIN 驗證失敗");
    throw new Error(`頭像同步失敗 (${response.status})`);
  }
}
