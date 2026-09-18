import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { ACHIEVEMENTS, ACHIEVEMENT_SERIES, achievementById, achievementSeriesProgress, equipAchievementReward, equippedAchievementReward, normalizeAchievementStats, recordAchievementGame } from "../src/game/achievements.js";
import { createAdventureGame, normalizeRuntimeGame, normalizeSession, applyPlayerDigit, clearEditableCell, applyHintFill, settleCompletedGame } from "../src/game/flow.js";
import { applyImmediateTreasure, TREASURE_CARDS } from "../src/game/adventure.js";
import { exportSaveCode, parseSaveCode, mergeProgressHighWater, preferSaveSide, rewardProgress } from "../src/state/store.js";

const fresh = (extra = {}) => parseSaveCode(exportSaveCode({ coins: 20, ...extra })).progress;
const reconcile = (progress) => recordAchievementGame(progress).progress;
const record = (progress, runId, context = {}) => recordAchievementGame(progress, { runId, mode: "hard", stars: 3, perfect: true, pure: true, barehand: true, noNotes: true, speed: true, ...context }).progress;
const merge = (a, b) => reconcile(mergeProgressHighWater(a, b));
const oldCoins = { firstClear: 10, fiveClears: 20, twentyClears: 40, fiftyClears: 80, starCollector: 20, starMaster: 60, firstPerfect: 20, tenPerfect: 60, fiveSpeed: 30, fiveAlin: 30 };
assert.equal(ACHIEVEMENT_SERIES.length, 15);
assert.equal(ACHIEVEMENTS.length, 94);
assert.equal(new Set(ACHIEVEMENTS.map(stage => stage.id)).size, 94);
for (const stage of ACHIEVEMENTS) assert.equal(stage.coins, oldCoins[stage.id] || 0, "only legacy rewards may issue coins");
for (const series of ACHIEVEMENT_SERIES) {
  for (const target of [5, 10, 20, 50, 100]) assert(series.stages.some(stage => stage.target === target));
  assert.equal(new Set(series.stages.map(stage => stage.name)).size, series.stages.length);
}
const legacy = fresh({ completedGames: 100, totalStars: 300, coins: 7, achievements: Object.keys(oldCoins), achievementStats: { perfectGames: 12, speedGames: 5, alinGames: 5 }, floors: { easy: 200, medium: 50, hard: 90, alin: 400 } });
const migrated = reconcile(legacy);
assert.equal(migrated.coins, 7, "old rewards cannot be issued again during upgrade");
assert(migrated.achievements.includes("hundredClears"));
assert.equal(migrated.achievementStats.noMistakeGames, 12);
assert.equal(migrated.achievementStats.noHintGames, 12);
assert.equal(migrated.achievementStats.hardGames, 0, "legacy floor is not evidence for a mode");
assert.equal(migrated.achievementStats.pureGames, 0);
assert.deepEqual(normalizeAchievementStats({ achievements: ["fourModesVeteran"] }).modeGames, { easy: 20, medium: 20, hard: 20, alin: 20 }, "a known unlocked mode badge is explicit evidence");
assert.equal(recordAchievementGame(migrated).changed, false, "reconcile must reach a stable state");

let progress = reconcile(fresh());
for (let count = 1; count <= 101; count++) {
  const runId = `tier-${count}`;
  const before = progress;
  progress = record(progress, runId);
  assert.deepEqual(record(progress, runId), progress, "same run is idempotent");
  assert(before.coins <= progress.coins);
  const series = ACHIEVEMENT_SERIES.find(item => item.id === "pure");
  const summary = achievementSeriesProgress(progress, series);
  assert.equal(summary.earned.length, series.stages.filter(stage => stage.target <= count).length);
  assert.equal(summary.next?.target, series.stages.find(stage => stage.target > count)?.target);
}
assert.equal(progress.achievementStats.pureGames, 100, "finite goals cap proof storage");
assert.equal(progress.completedGames, 101);
assert.equal(progress.coins, 20 + Object.entries(oldCoins).filter(([id]) => id !== "fiveAlin").reduce((sum, [, coins]) => sum + coins, 0));

const baseline = reconcile(fresh({ completedGames: 10, totalStars: 30, achievementStats: { perfectGames: 10 } }));
const deviceA = record(baseline, "device-a");
const deviceB = record(baseline, "device-b");
const deviceC = record(baseline, "device-c");
const combined = merge(deviceA, deviceB);
assert.equal(combined.completedGames, 12, "two independent offline wins must both count");
assert.equal(combined.achievementStats.perfectGames, 12);
assert.equal(combined.totalStars, 36);
assert.deepEqual(combined.achievementEvidence, merge(deviceB, deviceA).achievementEvidence);
assert.deepEqual(combined.achievementEvidence, merge(combined, combined).achievementEvidence);
assert.deepEqual(merge(merge(deviceA, deviceB), deviceC).achievementEvidence, merge(deviceA, merge(deviceB, deviceC)).achievementEvidence);
assert.equal(merge(deviceA, record(baseline, "device-a")).completedGames, 11, "same win imported twice counts once");
assert.equal(mergeProgressHighWater({ ...deviceA, coins: 1 }, { ...deviceB, coins: 999 }).coins, 1, "spent currency must not return during merge");

// Merge independently capped histories in different orders, including overlap.
let left = fresh(), right = fresh();
for (let i = 0; i < 130; i++) { left = record(left, `a-${i}`); right = record(right, `b-${i}`); }
const saturated = merge(left, right);
assert.equal(saturated.achievementStats.pureGames, 100);
assert.equal(saturated.completedGames, 260);
assert.deepEqual(saturated.achievementEvidence, merge(right, left).achievementEvidence);
assert.deepEqual(saturated.achievementEvidence, merge(saturated, left).achievementEvidence);
assert(exportSaveCode(saturated).length < 150000, "achievement proofs must fit the existing save limit");

const full = reconcile(fresh({ completedGames: 500, totalStars: 500, achievementStats: Object.fromEntries(Object.keys(normalizeAchievementStats()).filter(key => key !== "modeGames").map(key => [key, 100])) }));
assert.equal(full.achievements.length, 94);
for (const [type, id] of Object.entries({ title: "hundredClears", avatarFrame: "fourModesVeteran", boardDecoration: "fiftyPure", badge: "firstClear" })) {
  const equipped = equipAchievementReward(full, type, id);
  const restored = parseSaveCode(exportSaveCode(equipped)).progress;
  assert.equal(equippedAchievementReward(restored, type)?.achievement.id, id);
  assert.equal(restored.achievements.length, 94, "more than 50 stages must survive save/export");
  assert.equal(equippedAchievementReward(equipAchievementReward(restored, type, ""), type), null);
  assert.equal(equippedAchievementReward(mergeProgressHighWater(restored, fresh()), type)?.achievement.id, id);
}
assert.equal(equipAchievementReward(fresh(), "title", "hundredClears").equippedTitle, "");
assert.equal(equippedAchievementReward(fresh({ equippedTitle: "hundredClears" }), "title"), null);
assert.equal(achievementById("unknown"), null);

const makeGame = () => { const game = createAdventureGame({ difficulty: "hard" }); game.started = true; game.selected = game.puzzle.findIndex(value => !value); return game; };
const finish = (game, options) => { game.values = [...game.solution]; return settleCompletedGame(game, options); };
const clean = makeGame();
const cleanResult = finish(clean);
assert(cleanResult.pure && cleanResult.barehand && cleanResult.noNotes);
const oldSession = makeGame();
delete oldSession.achievementTrackingVersion;
delete oldSession.noteActions;
const oldResult = finish(normalizeRuntimeGame(oldSession));
assert(!oldResult.noNotes && !oldResult.pure && !oldResult.barehand && !oldResult.lastHeart, "unknown pre-V2 history cannot earn strict achievements");
const noted = makeGame();
applyPlayerDigit(noted, 1, { noteMode: true });
clearEditableCell(noted);
assert(noted.notes[noted.selected].length === 0);
const notedResult = finish(normalizeRuntimeGame(noted));
assert(!notedResult.noNotes && notedResult.pure, "erasing notes cannot erase history; pure permits manual notes");
const candidate = makeGame();
assert(applyImmediateTreasure(candidate, TREASURE_CARDS.candidateLens));
clearEditableCell(candidate);
assert(!finish(normalizeRuntimeGame(candidate)).noNotes);
const hinted = makeGame();
applyHintFill(hinted);
const hintedResult = finish(hinted);
assert(!hintedResult.noNotes && !hintedResult.noHint && !hintedResult.perfect && !hintedResult.pure);
const equipped = makeGame(); equipped.equippedCards = ["shield"];
assert(!finish(equipped).barehand, "unused equipped treasure still disqualifies barehand");
const wounded = makeGame();
const wrong = wounded.solution[wounded.selected] % 9 + 1;
applyPlayerDigit(wounded, wrong); applyPlayerDigit(wounded, wrong);
assert.equal(wounded.minHealth, 1);
applyImmediateTreasure(wounded, TREASURE_CARDS.heartPotion);
assert(finish(normalizeRuntimeGame(wounded)).lastHeart, "healing should retain low-health history");
const revived = makeGame(); revived.minHealth = 0; revived.revivesUsed = 1;
const revivedResult = finish(normalizeRuntimeGame(revived));
assert(!revivedResult.lastHeart && !revivedResult.barehand && !revivedResult.pure);
const frozen = makeGame(); applyImmediateTreasure(frozen, TREASURE_CARDS.hourglass);
assert(finish(frozen).speed, "speed is explicitly a casual achievement allowing timer treasures");
const alin = recordAchievementGame(fresh(), finish(makeGame(), { alinMode: true })).progress;
assert.equal(alin.achievementStats.alinGames, 1);
assert.equal(alin.achievementStats.hardGames, 0);
assert.equal(alin.achievementStats.hardNoNoteGames, 0);

// Use the live reward order: establish legacy baseline before the first V2 reward.
let settled = rewardProgress(fresh(), cleanResult.xpReward, cleanResult.timeBonus, cleanResult.stars, "hard", 1, { persist: false, runId: cleanResult.runId });
const result = recordAchievementGame(settled, cleanResult);
settled = result.progress;
assert.equal(settled.completedGames, 1);
assert.equal(settled.totalStars, 3);
assert.equal(rewardProgress(settled, 999, 999, 3, "hard", 1, { persist: false, runId: cleanResult.runId }), settled);
clean.unlockedAchievementIds = result.unlocked.map(stage => stage.id);
const restoredTerminal = normalizeSession({ game: clean, alinMode: false, equippedCards: [] }, { allowTerminal: true });
assert.deepEqual(restoredTerminal.game.unlockedAchievementIds, clean.unlockedAchievementIds);
assert.equal(settleCompletedGame(restoredTerminal.game), null);
// Upgrade discovery must not make an old device's balance newer than cloud.
const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const oldLocal = fresh({ completedGames: 10, updatedAt: "2026-01-01T00:00:00Z" });
const boot = vm.createContext({ loadProgress: () => oldLocal, recordAchievementGame, saveProgress: (value, options) => {
  if (options?.touch !== false) value.updatedAt = new Date().toISOString();
} });
vm.runInContext(appSource.slice(appSource.indexOf("let progress = loadProgress();"), appSource.indexOf("const restoredSession = loadSession();")), boot);
assert.equal(preferSaveSide(vm.runInContext("progress", boot), { ...oldLocal, coins: 1, updatedAt: "2026-02-01T00:00:00Z" }), "cloud");
console.log("Achievement V2 passed: 15 series / 94 stages, legacy rewards, tiers, offline merge, cosmetics, strict run evidence, reload settlement.");
