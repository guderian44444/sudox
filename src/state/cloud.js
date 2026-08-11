import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config.js?v=v52";

const CLOUD_PIN_KEY = "sudox-cloud-pin-v1";

export function cloudConfigured() {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) && SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");
}

export function validCloudPin(pin) {
  return /^\d{4}$/.test(pin);
}

export function normalizePlayerName(value) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 16);
}

export function loadCloudPin() {
  return localStorage.getItem(CLOUD_PIN_KEY) || "";
}

export function saveCloudPin(pin) {
  if (!validCloudPin(pin)) throw new Error("PIN 必須是 4 位數字");
  localStorage.setItem(CLOUD_PIN_KEY, pin);
}

export async function callRpc(name, body) {
  if (!cloudConfigured()) throw new Error("雲端資料庫尚未設定");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text();
    if (/duplicate key|unique/i.test(detail)) throw new Error("這個玩家名稱已經存在，請改名或選擇載入雲端進度");
    if (/Invalid cloud PIN/i.test(detail)) throw new Error("玩家名稱或家庭 PIN 不正確");
    if (/Invalid cloud save/i.test(detail)) throw new Error("雲端存檔格式不正確");
    if (/Insufficient island inventory/i.test(detail)) throw new Error("小屋倉庫的貨物數量不足");
    if (/Invalid island shipment route/i.test(detail)) throw new Error("對方設施或你的運輸設施已變更，請重新整理物流名單");
    if (/Invalid island shipment|Invalid island network profile/i.test(detail)) throw new Error("跨島物流資料不正確，請重新整理後再試");
    if (/PGRST202|Could not find the function/i.test(detail) && /save_cloud_progress_if_current/i.test(name)) {
      throw new Error("雲端防重複收成尚未安裝，請先執行 cloud-save-concurrency-migration.sql");
    }
    if (/PGRST202|Could not find the function|island_network_profiles|island_shipments/i.test(detail) && /island/i.test(name)) {
      throw new Error("跨島物流雲端尚未安裝，請先執行 island-logistics-migration.sql");
    }
    if (/P0001/i.test(detail)) throw new Error("玩家名稱或家庭 PIN 不正確");
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

/** Save only if the cloud still contains the exact version read by this device. */
export async function saveCloudProgressIfCurrent({ playerId, playerName, pin, saveCode, expectedSaveCode }) {
  if (!navigator.onLine) throw new Error("目前離線，進度已先保存在這台裝置");
  return callRpc("save_cloud_progress_if_current", {
    p_player_id: playerId,
    p_player_name: playerName,
    p_pin: pin,
    p_save_code: saveCode,
    p_expected_save_code: expectedSaveCode
  });
}

export async function loadCloudProgress(playerName, pin) {
  if (!navigator.onLine) throw new Error("目前離線，無法載入雲端進度");
  const saveCode = await callRpc("load_cloud_progress", { p_player_name: playerName, p_pin: pin });
  if (!saveCode) throw new Error("找不到這位玩家的雲端進度");
  return saveCode;
}

export async function renameCloudPlayer({ playerId, pin, playerName }) {
  if (!navigator.onLine) throw new Error("目前離線，無法修改玩家名稱");
  const cleanName = normalizePlayerName(playerName);
  if (!cleanName) throw new Error("請輸入新的玩家名稱");
  return callRpc("rename_cloud_player", {
    p_player_id: playerId,
    p_pin: pin,
    p_player_name: cleanName
  });
}
