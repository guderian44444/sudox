import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createAdventureGame, applyPlayerDigit, clearEditableCell, applyHintFill, collectBoardProgressEvents, collectNewMilestones, normalizeSession, settleCompletedGame, claimRewardCard } from "../src/game/flow.js";
import { generatePuzzle, countSolutions, validSudokuGrid } from "../src/game/sudoku.js";
import { advanceGameClock } from "../src/game/timer.js";
import { createPlayerProgress, loadProgress, saveProgress, loadSession, saveSession, clearSession, rewardProgress, addCard, mergeProgressHighWater, exportSaveCode, parseSaveCode } from "../src/state/store.js";

const source = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const version = /const APP_VERSION = "(v\d+)"/.exec(source)[1];
const { storageWarning, retryLocalWrites } = await import(`../src/state/storage.js?v=${version}`);
const { createCloudPin, validCloudPin } = await import(`../src/state/cloud.js?v=${version}`);
assert(validCloudPin(createCloudPin()), "generated recovery PIN must be four digits");
const memory = new Map();
let writes = 0, failWrites = false;
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => { if (failWrites) throw new Error("QuotaExceededError"); memory.set(key, value); writes++; },
  removeItem: (key) => { if (failWrites) throw new Error("QuotaExceededError"); memory.delete(key); }
};

// One cell, including erase/re-enter and a restore, must never farm streak rewards.
const game = createAdventureGame(); game.started = true;
const cell = game.selected, digit = game.solution[cell];
assert.equal(applyPlayerDigit(game, digit).type, "correct");
for (let i = 0; i < 20; i++) assert.equal(applyPlayerDigit(game, digit).type, "noop");
assert.equal(game.actions, 1); assert.equal(game.correctStreak, 1);
clearEditableCell(game);
const resumed = normalizeSession({ game }).game;
applyPlayerDigit(resumed, digit);
assert.equal(resumed.correctStreak, 1);
assert.equal(collectBoardProgressEvents(resumed).events.some((event) => event.goal === "streak"), false);
assert.equal(collectNewMilestones(resumed).some((milestone) => milestone.id === "streak15"), false);
assert.equal(applyPlayerDigit(resumed, 99).type, "noop");
const hintCell = game.values.findIndex((value) => !value);
applyHintFill(game, hintCell); clearEditableCell(game, hintCell);
applyPlayerDigit(game, game.solution[hintCell], { index: hintCell });
assert.equal(game.correctStreak, 0, "answer hints reset the combo and cannot be erased/refilled to restore it");
assert.equal(normalizeSession({ game: { ...game, puzzle: Array(81).fill(1), solution: Array(81).fill(1), values: Array(81).fill(1) } }), null);
assert.equal(countSolutions(Array(81).fill(1)), 0);
assert.deepEqual(normalizeSession({ game, equippedCards: ["unknownCard"] }).equippedCards, []);

// Deterministic generation workload, validating uniqueness and unchanged clue policy.
let seed = 20260918;
const originalRandom = Math.random;
Math.random = () => ((seed = Math.imul(1664525, seed) + 1013904223 >>> 0) / 2 ** 32);
const generationMs = [];
try {
  for (const difficulty of ["easy", "medium", "hard"]) for (let i = 0; i < 100; i++) {
    const start = performance.now(); const generated = generatePuzzle(difficulty);
    if (difficulty === "hard") generationMs.push(performance.now() - start);
    assert(validSudokuGrid(generated.solution, false));
    assert.equal(countSolutions(generated.puzzle), 1);
    assert(generated.puzzle.every((value, index) => !value || value === generated.solution[index]));
  }
} finally { Math.random = originalRandom; }
generationMs.sort((a,b) => a-b);
console.log(`Hard generation (desktop, 100): median ${generationMs[50].toFixed(2)} ms, p95 ${generationMs[94].toFixed(2)} ms, max ${generationMs.at(-1).toFixed(2)} ms`);

// Completion + pending cards + rewards share one storage write; reload and claim remain idempotent.
let progress = loadProgress();
const secondPlayer = createPlayerProgress("新玩家");
assert.notEqual(secondPlayer.playerId, progress.playerId, "new players need a separate cloud identity");
assert.equal(secondPlayer.playerName, "新玩家");
assert.equal(secondPlayer.coins, 20, "new players must not inherit the previous player's progress");
assert.equal(secondPlayer.completedGames, 0);
game.values = [...game.solution];
const settlement = settleCompletedGame(game);
progress = rewardProgress(progress, settlement.xpReward, settlement.timeBonus, settlement.stars, "easy", 1, { persist: false, runId: game.runId });
const completedCount = progress.completedGames;
const before = writes;
saveProgress(progress, { settledSession: { game, equippedCards: [], alinMode: false } });
assert.equal(writes, before + 1);
clearSession();
let restored = loadSession();
assert.equal(restored.game.remainingClaims, game.remainingClaims);
assert.equal(restored.game.completed, true);
assert.equal(loadProgress().settledSession, undefined, "local checkpoint must not enter cloud progress");
assert.equal(parseSaveCode(exportSaveCode(loadProgress())).session, null);
assert.equal(rewardProgress(loadProgress(), 100, 100, 3, "easy", 1, { runId: game.runId }).completedGames, completedCount);
const card = restored.game.cardChoices[0];
assert(claimRewardCard(restored.game, card));
progress = addCard(loadProgress(), card, { persist: false });
saveProgress(progress, { settledSession: restored });
const count = progress.inventory[card];
restored = loadSession();
assert.equal(claimRewardCard(restored.game, card), false);
assert.equal(loadProgress().inventory[card], count);
saveProgress(progress, { settledSession: null, touch: false });
clearSession();
assert.equal(loadSession(), null);
const failed = createAdventureGame(); failed.started = true; failed.failed = true; failed.health = 0;
saveSession({ game: failed }); assert.equal(loadSession().game.failed, true);

// Failed local writes preserve the latest values in memory and are visibly retryable.
failWrites = true;
saveProgress({ ...progress, coins: 999 });
assert.equal(loadProgress().coins, 999); assert(storageWarning());
failWrites = false;
assert(retryLocalWrites()); assert.equal(storageWarning(), "");
assert.equal(JSON.parse(memory.get("sudox-progress-v3")).coins, 999);
const merged = mergeProgressHighWater({ ...progress, coins: 3, achievements: ["firstClear"], achievementStats: { perfectGames: 1 } }, { coins: 999, achievements: ["speedClear"], achievementStats: { perfectGames: 4 } });
assert.deepEqual(merged.achievements, ["firstClear", "speedClear"]);
assert.equal(merged.achievementStats.perfectGames, 4); assert.equal(merged.coins, 3);
const clockGame = { started: true, elapsed: 0, frozenSeconds: 2 };
advanceGameClock(clockGame, 3400); advanceGameClock(clockGame, 1800);
assert.equal(clockGame.elapsed, 3); assert.equal(clockGame.clockRemainderMs, 200);
clockGame.completed = true; advanceGameClock(clockGame, 10000); assert.equal(clockGame.elapsed, 3);

// Exercise the real audio module with Safari's interrupted state and failed resume/node creation.
let context, constructed = 0, resumedAudio = 0, played = 0;
class FakeAudioContext {
  state = "suspended"; currentTime = 0; destination = {};
  constructor() { context = this; constructed++; }
  async resume() { resumedAudio++; if (this.rejectResume) throw new Error("interrupted"); this.state = "running"; }
  async close() { this.state = "closed"; }
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  createOscillator() {
    if (this.failNodes) throw new Error("audio hardware unavailable");
    return { frequency: { setValueAtTime() {} }, connect(gain) { return gain; }, start() { played++; }, stop() {}, disconnect() {} };
  }
}
globalThis.AudioContext = FakeAudioContext;
const audio = await import("../src/game/audio.js");
const tick = () => new Promise((resolve) => setImmediate(resolve));
audio.playSound("correct"); await tick(); assert.equal(played, 1);
context.state = "interrupted"; audio.playSound("correct"); await tick(); assert.equal(resumedAudio, 2); assert.equal(played, 2);
context.state = "closed"; audio.playSound("correct"); await tick(); assert.equal(constructed, 2);
context.state = "interrupted"; context.rejectResume = true;
assert.equal(await audio.resumeAudio(), false);
audio.playSound("correct"); await tick(); assert.equal(constructed, 3);
context.failNodes = true; assert.doesNotThrow(() => audio.playSound("correct"));
audio.setSoundEnabled(false); const muted = played; audio.playSound("correct"); await tick(); assert.equal(played, muted);

// Run the actual sync functions against deferred network operations; no live cloud writes.
const scheduled = []; let releaseRead, releaseWrite, uploaded;
const ctx = vm.createContext({
  progress: { playerId: "test", playerName: "test", coins: 1, updatedAt: "2026-01-01T00:00:00Z" },
  cloudSyncTimer: null, cloudSyncInFlight: null, cloudSyncAgain: false, cloudHydrationPending: false, cloudSyncStatus: "", showSaveCenter: false,
  loadCloudPin: () => "1234", cloudConfigured: () => true, validCloudPin: () => true,
  setTimeout: (fn) => { scheduled.push(fn); return fn; }, clearTimeout: () => {},
  cloudProgressSaveCode: (value) => JSON.stringify(value),
  loadCloudProgress: () => new Promise((resolve) => { releaseRead = resolve; }),
  parseSaveCode: (value) => ({ progress: JSON.parse(value) }), saveTimestampMs: (value) => Date.parse(value.updatedAt),
  mergeProgressHighWater: (value) => value, saveProgress() {}, render() {}, adoptCloudSaveCode() { throw Error("unexpected adoption"); },
  saveCloudProgressIfCurrent: ({ saveCode }) => { uploaded = JSON.parse(saveCode); return new Promise((resolve) => { releaseWrite = resolve; }); }
});
vm.runInContext(source.slice(source.indexOf("function scheduleCloudSync()"), source.indexOf("async function openLeaderboardModal()")), ctx);
const sync = ctx.syncCloudNow();
ctx.progress.coins = 2; ctx.scheduleCloudSync();
releaseRead(JSON.stringify({ ...ctx.progress, coins: 1 })); await tick();
assert.equal(uploaded.coins, 2, "snapshot must include actions during remote read");
ctx.progress.coins = 3; ctx.scheduleCloudSync();
releaseWrite(true); await sync;
assert(scheduled.length, "actions during write must schedule another sync");
const trailing = scheduled.pop()();
releaseRead(JSON.stringify({ ...ctx.progress, coins: 2 })); await tick();
assert.equal(uploaded.coins, 3); releaseWrite(true); await trailing;
const switching = ctx.syncCloudNow(); ctx.progress.playerId = "different";
releaseRead(JSON.stringify({ ...ctx.progress, coins: 99 })); assert.equal(await switching, false);

// Harvest must use its own transaction variables (not unrelated sync locals).
let harvestWrite, harvestPayload;
const harvest = vm.createContext({
  progress: { playerId: "harvester", playerName: "harvester", coins: 20, island: { inventory: 0 } }, island: { inventory: 0 },
  cloudSyncTimer: null, cloudSyncStatus: "", islandStatus: "", navigator: { onLine: true }, clearTimeout() {},
  loadCloudPin: () => "1234", cloudConfigured: () => true, validCloudPin: () => true, syncCloudNow: async () => true,
  collectFacility: () => ({ ok: true, state: { inventory: 1 } }), renderIslandView() {}, saveProgress() {},
  cloudProgressSaveCode: JSON.stringify,
  saveCloudProgressIfCurrent: (payload) => { harvestPayload = payload; return new Promise(resolve => { harvestWrite = resolve; }); },
  loadCloudProgress: async () => JSON.stringify({ inventory: 2 }),
  adoptCloudSaveCode: (code) => { harvest.island = JSON.parse(code); }
});
vm.runInContext(source.slice(source.indexOf("async function collectIslandFacilitySafely("), source.indexOf("function changeIslandZoom(")), harvest);
const collected = harvest.collectIslandFacilitySafely("farm"); await tick();
assert(harvestPayload, "online harvest must reach conditional cloud write without ReferenceError");
assert.equal(JSON.parse(harvestPayload.saveCode).island.inventory, 1);
harvestWrite(true); await collected; assert.match(harvest.islandStatus, /雲端已確認/);
const conflict = harvest.collectIslandFacilitySafely("farm"); await tick(); harvestWrite(false); await conflict;
assert.equal(harvest.island.inventory, 2, "conflicting harvest must adopt remote inventory");
const switchedHarvest = harvest.collectIslandFacilitySafely("farm"); await tick();
harvest.progress = { playerId: "other", playerName: "other", coins: 99 }; harvestWrite(false); await switchedHarvest;
assert.equal(harvest.progress.coins, 99, "in-flight harvest cannot overwrite a switched player");
harvest.saveCloudProgressIfCurrent = async () => { throw Error("offline"); };
const beforeHarvest = harvest.progress; await harvest.collectIslandFacilitySafely("farm");
assert.equal(harvest.progress, beforeHarvest, "failed conditional harvest restores prior progress");

// A stalled response body is still covered by the RPC timeout.
const cloudSource = readFileSync(new URL("../src/state/cloud.js", import.meta.url), "utf8");
let clearedTimeouts = 0;
const timeoutContext = vm.createContext({
  AbortController,
  setTimeout: (callback) => setTimeout(callback, 1),
  clearTimeout: (id) => { clearedTimeouts++; clearTimeout(id); },
  fetch: async (_url, { signal }) => ({ text: () => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })) })
});
vm.runInContext(cloudSource.slice(cloudSource.indexOf("export async function fetchWithTimeout")).replace("export ", ""), timeoutContext);
await assert.rejects(timeoutContext.fetchWithTimeout("https://test.invalid"), /連線逾時/);
assert.equal(clearedTimeouts, 1);

// Run service-worker fetch handlers with fake cache/network: never cache errors or return HTML for assets.
const handlers = {}, cacheEntries = new Map(); let offline = false, status = 200, fetches = 0;
const fakeCache = { match: async (key) => cacheEntries.get(key), put: async (key, value) => cacheEntries.set(key, value) };
vm.runInNewContext(readFileSync(new URL("../sw.js", import.meta.url), "utf8"), {
  self: { location: { href: "https://test.local/sw.js", origin: "https://test.local" }, addEventListener: (name, callback) => { handlers[name] = callback; } },
  URL, Response, caches: { open: async () => fakeCache },
  fetch: async () => { fetches++; if (offline) throw Error("offline"); return new Response("asset", { status }); }
});
async function request(url, mode = "cors") {
  let promise; const pending = [];
  handlers.fetch({ request: { method: "GET", url, mode }, respondWith: (value) => { promise = value; }, waitUntil: (value) => pending.push(value) });
  const response = await promise; await Promise.all(pending); return response;
}
assert.equal(await request("https://other.local/a.js"), undefined);
status = 404; await request("https://test.local/public/assets/missing.png"); assert.equal(cacheEntries.size, 0);
status = 200; await request("https://test.local/public/assets/friend.webp?t=1"); const calls = fetches;
await request("https://test.local/public/assets/friend.webp?t=2"); assert.equal(cacheEntries.size, 1); assert.equal(fetches, calls);
cacheEntries.set("/index.html", new Response("<html>shell</html>")); offline = true;
assert.equal((await request("https://test.local/public/assets/missing.png")).type, "error");
assert.equal(await (await request("https://test.local/", "navigate")).text(), "<html>shell</html>");
console.log("Stability regressions passed: streak, restore/claims, storage recovery, merge, clock, audio, trailing sync/account switch, offline cache.");
