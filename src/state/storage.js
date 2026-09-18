// Keep failed writes in memory, and make persistence failures visible to the UI.
const pending = new Map();

export function storageWarning() {
  return pending.size ? "本機儲存失敗，最新進度暫留記憶體；請勿關閉頁面，釋放空間後重試保存。" : "";
}

function notify() {
  globalThis.dispatchEvent?.(new CustomEvent("sudox-storage-status"));
}

export function readLocal(key) {
  if (pending.has(key)) return pending.get(key);
  try { return localStorage.getItem(key); } catch { return null; }
}

export function writeLocal(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    const recovered = pending.delete(key);
    if (recovered) notify();
    return true;
  } catch {
    pending.set(key, value);
    notify();
    return false;
  }
}

export function retryLocalWrites() {
  for (const [key, value] of pending) writeLocal(key, value);
  return pending.size === 0;
}
