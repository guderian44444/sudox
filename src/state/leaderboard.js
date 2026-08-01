import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config.js";

const QUEUE_KEY = "sudox-score-queue-v1";
const difficulties = new Set(["easy", "medium", "hard"]);

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

export function pendingScoreCount() {
  return loadQueue().length;
}

export function buildScore(progress, game) {
  const score = game.floor * 10000 + game.stars * 1000 + Math.max(0, 2000 - game.elapsed) - game.mistakes * 100;
  return {
    p_player_id: progress.playerId,
    p_player_name: progress.playerName,
    p_difficulty: game.difficulty,
    p_floor: game.floor,
    p_score: Math.max(0, Math.round(score)),
    p_elapsed_seconds: Math.max(0, Math.round(game.elapsed)),
    p_mistakes: Math.max(0, Math.round(game.mistakes)),
    p_stars: Math.max(1, Math.min(3, Math.round(game.stars)))
  };
}

async function sendScore(score) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_leaderboard_score`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(score)
  });
  if (!response.ok) throw new Error(`排行榜寫入失敗 (${response.status})`);
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
  const queue = loadQueue();
  const existing = queue.findIndex((item) => item.p_player_id === score.p_player_id && item.p_difficulty === score.p_difficulty);
  if (existing >= 0) {
    if (score.p_floor > queue[existing].p_floor || score.p_score > queue[existing].p_score) queue[existing] = score;
  } else queue.push(score);
  saveQueue(queue);
  return flushPendingScores();
}

export async function fetchLeaderboard(difficulty = "easy") {
  if (!leaderboardConfigured()) throw new Error("排行榜尚未連接資料庫");
  if (!difficulties.has(difficulty)) throw new Error("排行榜難度不正確");
  const query = new URLSearchParams({
    select: "player_id,player_name,difficulty,floor,score,elapsed_seconds,mistakes,stars,updated_at",
    difficulty: `eq.${difficulty}`,
    order: "floor.desc,score.desc",
    limit: "50"
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard_scores?${query}`, { headers: headers() });
  if (!response.ok) throw new Error(`無法讀取排行榜 (${response.status})`);
  return response.json();
}
