import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config.js";

const CLOUD_PIN_KEY = "sudox-cloud-pin-v1";

export function cloudConfigured() {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) && SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");
}

export function validCloudPin(pin) {
  return /^\d{4}$/.test(pin);
}

export function loadCloudPin() {
  return localStorage.getItem(CLOUD_PIN_KEY) || "";
}

export function saveCloudPin(pin) {
  if (!validCloudPin(pin)) throw new Error("PIN 必須是 4 位數字");
  localStorage.setItem(CLOUD_PIN_KEY, pin);
}

async function callRpc(name, body) {
  if (!cloudConfigured()) throw new Error("雲端資料庫尚未設定");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text();
    if (/duplicate key|unique/i.test(detail)) throw new Error("這個玩家名稱已經存在，請改名或選擇載入雲端進度");
    if (/Invalid cloud PIN|P0001/i.test(detail)) throw new Error("玩家名稱或家庭 PIN 不正確");
    throw new Error(`雲端連線失敗 (${response.status})`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function saveCloudProgress({ playerId, playerName, pin, saveCode }) {
  if (!navigator.onLine) throw new Error("目前離線，進度已先保存在這台裝置");
  return callRpc("save_cloud_progress", {
    p_player_id: playerId,
    p_player_name: playerName,
    p_pin: pin,
    p_save_code: saveCode
  });
}

export async function loadCloudProgress(playerName, pin) {
  if (!navigator.onLine) throw new Error("目前離線，無法載入雲端進度");
  const saveCode = await callRpc("load_cloud_progress", { p_player_name: playerName, p_pin: pin });
  if (!saveCode) throw new Error("找不到這位玩家的雲端進度");
  return saveCode;
}
