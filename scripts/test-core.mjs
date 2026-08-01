import { readFileSync } from "node:fs";
import { countSolutions, createGame, DIFFICULTIES, generatePuzzle, PUZZLES, relatedCells, solveSudoku } from "../src/game/sudoku.js";
import { activateAutomaticTreasures, ADVENTURE_RULES, applyHintTreasure, applyImmediateTreasure, candidatesFor, completedSudokuUnits, drawTreasureCards, newlyCompletedSudokuUnits, strongestEquippedRevive, sudokuUnitCells, treasureClaimsForFloor, treasurePool, TREASURE_AUTO_EFFECTS, TREASURE_CARDS, TREASURE_EFFECTS } from "../src/game/adventure.js";
import { ACHIEVEMENTS, achievementValue, recordAchievementGame } from "../src/game/achievements.js";
import { chooseFriendPair, chooseGardenEel, FRIEND_ROSTER, friendPairKey, GARDEN_EEL_VARIANTS } from "../src/game/friends.js";
import { normalizePlayerName, validCloudPin } from "../src/state/cloud.js";
import { buildScore, leaderboardConfigured, normalizeLeaderboardTaunt } from "../src/state/leaderboard.js";
import { exportSaveCode, importSaveCode } from "../src/state/store.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const stylesheet = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
assert(FRIEND_ROSTER.length === 3 && FRIEND_ROSTER.some((friend) => friend.id === "otter"), "夥伴名單應包含水獺");
const firstFriendPair = chooseFriendPair("", () => 0);
const nextFriendPair = chooseFriendPair(firstFriendPair.key, () => 0);
assert(firstFriendPair.friends.length === 2 && new Set(firstFriendPair.friends.map((friend) => friend.id)).size === 2, "慶祝應選出兩位不同夥伴");
assert(nextFriendPair.key !== firstFriendPair.key, "同一組夥伴不應連續出現");
assert(friendPairKey([...firstFriendPair.friends].reverse()) === firstFriendPair.key, "夥伴配對鍵不應受站位順序影響");
const orangeEel = chooseGardenEel(() => 0);
const whiteEel = chooseGardenEel(() => 0.999999);
assert(GARDEN_EEL_VARIANTS.length === 2 && orangeEel.cell === 0 && orangeEel.variant === "orange", "橘色花園鰻應可從第一格偷看");
assert(whiteEel.cell === 80 && whiteEel.variant === "white", "白色花園鰻應可從最後一格偷看");
assert(/grid-template-rows:\s*repeat\(9,\s*minmax\(0,\s*1fr\)\)/.test(stylesheet), "數獨盤面必須固定為 9 個可縮小橫列");
assert(/-webkit-text-size-adjust:\s*100%/.test(stylesheet), "iOS 內建瀏覽器不可自動放大文字而裁掉最下列");
assert(/garden-eel-peek/.test(stylesheet) && /@keyframes garden-eel-peek/.test(stylesheet), "花園鰻應有偷看動畫");
assert(/garden-eel-svg/.test(appSource) && /garden-eel-shape/.test(stylesheet), "花園鰻應使用連續向量身體輪廓");

function validSolution(solution) {
  const target = "123456789";
  const line = (values) => [...values].sort().join("") === target;
  for (let index = 0; index < 9; index += 1) {
    const row = solution.slice(index * 9, index * 9 + 9);
    const column = Array.from({ length: 9 }, (_, rowIndex) => solution[rowIndex * 9 + index]);
    if (!line(row) || !line(column)) return false;
  }
  return true;
}

function solveWithSingles(puzzle) {
  const values = [...puzzle];
  const units = [];
  for (let row = 0; row < 9; row += 1) units.push(Array.from({ length: 9 }, (_, col) => row * 9 + col));
  for (let col = 0; col < 9; col += 1) units.push(Array.from({ length: 9 }, (_, row) => row * 9 + col));
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxCol = 0; boxCol < 3; boxCol += 1) {
      units.push(Array.from({ length: 9 }, (_, offset) => (boxRow * 3 + Math.floor(offset / 3)) * 9 + boxCol * 3 + (offset % 3)));
    }
  }
  while (values.includes(0)) {
    let move = values.findIndex((value, index) => !value && candidatesFor(values, index).length === 1);
    if (move >= 0) {
      values[move] = candidatesFor(values, move)[0];
      continue;
    }
    let placed = false;
    for (const unit of units) {
      for (let number = 1; number <= 9; number += 1) {
        const spots = unit.filter((index) => !values[index] && candidatesFor(values, index).includes(number));
        if (spots.length === 1) {
          values[spots[0]] = number;
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) return false;
  }
  return validSolution(values);
}

for (const difficulty of Object.keys(DIFFICULTIES)) {
  for (const puzzleText of PUZZLES[difficulty]) {
    const puzzle = puzzleText.split("").map(Number);
    const solution = solveSudoku(puzzle);
    assert(puzzle.length === 81, `${difficulty} 盤面必須有 81 格`);
    assert(puzzle.some((value) => value === 0), `${difficulty} 題目必須包含空格`);
    assert(validSolution(solution), `${difficulty} 解答不符合數獨規則`);
    assert(countSolutions(puzzle) === 1, `${difficulty} 題目必須只有唯一解`);
    puzzle.forEach((value, index) => {
      assert(!value || value === solution[index], `${difficulty} 題目與解答不一致`);
    });
    if (difficulty === "easy") {
      const rowBlanks = Array.from({ length: 9 }, (_, row) => puzzle.slice(row * 9, row * 9 + 9).filter((value) => value === 0).length);
      const colBlanks = Array.from({ length: 9 }, (_, col) => Array.from({ length: 9 }, (_, row) => puzzle[row * 9 + col]).filter((value) => value === 0).length);
      assert(rowBlanks.every((count) => count <= 4), "輕鬆題每行最多只能有 4 個空格");
      assert(colBlanks.every((count) => count <= 4), "輕鬆題每列最多只能有 4 個空格");
      assert(solveWithSingles(puzzle), "輕鬆題必須能只靠裸單與隱單完成");
    }
  }
  const game = createGame(difficulty);
  assert(game.difficulty === difficulty, `${difficulty} 應建立對應難度遊戲`);
  assert(countSolutions(game.puzzle) === 1, `${difficulty} 即時生成題必須只有唯一解`);
  assert(validSolution(game.solution), `${difficulty} 即時生成解答必須有效`);
}

const generatedFingerprints = new Set(Array.from({ length: 3 }, () => generatePuzzle("medium").puzzle.join("")));
assert(generatedFingerprints.size === 3, "連續生成的關卡不應重複");

assert(solveSudoku(Array(81).fill(0)).every(Boolean), "解題器應可完成空盤面");
assert(relatedCells(40).size === 21, "中央格應包含 21 個同行、同列與同宮格子");
assert(ADVENTURE_RULES.easy.maxHealth > ADVENTURE_RULES.medium.maxHealth, "輕鬆難度血量應高於動腦");
assert(ADVENTURE_RULES.medium.maxHealth > ADVENTURE_RULES.hard.maxHealth, "動腦難度血量應高於高手");
assert(Object.keys(TREASURE_CARDS).length === 60, "寶物圖鑑應提供 60 種寶物");
assert(Object.values(TREASURE_CARDS).every((card) => TREASURE_EFFECTS.includes(card.effect)), "每張寶物都必須使用遊戲支援的效果");
assert(Object.values(TREASURE_CARDS).every((card) => Number.isFinite(card.value) && card.value > 0), "每張寶物的效果數值都必須有效");
assert(TREASURE_AUTO_EFFECTS.every((effect) => TREASURE_EFFECTS.includes(effect)), "自動生效寶物必須使用遊戲支援的效果");
assert(treasurePool("easy").length === 10, "輕鬆難度應使用前 10 種寶物");
assert(treasurePool("medium").length === 30, "動腦難度應使用前 30 種寶物");
assert(treasurePool("hard").length === 60, "高手難度應使用完整 60 種寶物");
assert(new Set(drawTreasureCards("hard", 3)).size === 3, "抽卡選項不可重複");
const completedUnitGame = createGame("easy");
assert(completedSudokuUnits(completedUnitGame.solution).rows.length === 9, "完成盤面應辨識 9 行");
assert(completedSudokuUnits(completedUnitGame.solution).columns.length === 9, "完成盤面應辨識 9 直列");
assert(completedSudokuUnits(completedUnitGame.solution).boxes.length === 9, "完成盤面應辨識 9 宮");
const almostCompleteValues = [...completedUnitGame.solution];
almostCompleteValues[0] = 0;
assert(!completedSudokuUnits(almostCompleteValues).rows.includes(0), "缺一格的行不可觸發完成特效");
assert(!completedSudokuUnits(almostCompleteValues).columns.includes(0), "缺一格的直列不可觸發完成特效");
assert(!completedSudokuUnits(almostCompleteValues).boxes.includes(0), "缺一格的宮不可觸發完成特效");
const laterUnits = newlyCompletedSudokuUnits(completedUnitGame.solution, { rows: [0], columns: [0], boxes: [0] });
assert(laterUnits.rows.length === 8 && !laterUnits.rows.includes(0), "已跳過波浪舞的行不可重複觸發");
assert(laterUnits.columns.length === 8 && !laterUnits.columns.includes(0), "已跳過波浪舞的直列不可重複觸發");
assert(laterUnits.boxes.length === 8 && !laterUnits.boxes.includes(0), "已跳過波浪舞的宮不可重複觸發");
assert(sudokuUnitCells("row", 2).join(",") === "18,19,20,21,22,23,24,25,26", "行波浪應依左到右排列 9 格");
assert(sudokuUnitCells("column", 2).join(",") === "2,11,20,29,38,47,56,65,74", "直列波浪應依上到下排列 9 格");
assert(sudokuUnitCells("box", 4).join(",") === "30,31,32,39,40,41,48,49,50", "宮波浪應依宮內順序排列 9 格");
assert(sudokuUnitCells("row", 2, 1).join(",") === "26,25,24,23,22,21,20,19,18", "行動畫第二型應由右到左排列 9 格");
assert(sudokuUnitCells("column", 2, 1).join(",") === "74,65,56,47,38,29,20,11,2", "直列動畫第二型應由下到上排列 9 格");
assert(sudokuUnitCells("box", 4, 1).join(",") === "30,31,32,41,50,49,48,39,40", "宮動畫第二型應沿外圈螺旋進入中心");
assert(strongestEquippedRevive(["revive"], { revive: 1 }) === "revive", "已裝備的復活寶物應可在失敗時使用");
assert(!strongestEquippedRevive([], { revive: 1 }), "未裝備的復活寶物不可在本關使用");
assert(strongestEquippedRevive(["revive", "phoenixCrown"], { revive: 1, phoenixCrown: 1 }) === "phoenixCrown", "同時裝備復活寶物時應優先使用效果較強者");

const effectGame = {
  health: 2, maxHealth: 5, shields: 0, values: Array(81).fill(0), notes: Array.from({ length: 81 }, () => []),
  selected: 40, frozenSeconds: 0, xpMultiplier: 1, extraCardClaims: 0
};
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.twinHeart) && effectGame.health === 4, "回血寶物應依數值回復且不超過上限");
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.ironWall) && effectGame.shields === 2, "護盾寶物應增加正確層數");
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.candidateLens) && effectGame.notes[40].length === 9, "候選寶物應為空格標出合法候選數字");
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.hourglass) && effectGame.frozenSeconds === 60, "計時寶物應增加凍結秒數");
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.luckyStar) && effectGame.xpMultiplier === 2, "經驗寶物應套用正確倍率");
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.goldKey) && effectGame.extraCardClaims === 2, "鑰匙寶物應增加正確抽卡數");
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.cometBadge) && effectGame.xpMultiplier === 4, "不同經驗寶物應可累加生效");
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.silverKey) && effectGame.extraCardClaims === 3, "不同鑰匙寶物應可累加選卡次數");
assert(treasureClaimsForFloor(1, effectGame.extraCardClaims) === 4, "第一層使用鑰匙後應包含基本掉落與額外選卡");
assert(treasureClaimsForFloor(2, effectGame.extraCardClaims) === 3, "一般探索層使用鑰匙仍應取得額外選卡");

const automaticGame = { xpMultiplier: 1, extraCardClaims: 0, usedCards: [] };
const automaticallyActivated = activateAutomaticTreasures(
  automaticGame,
  ["treasureKey", "luckyStar"],
  { treasureKey: 1, luckyStar: 1 }
);
assert(automaticallyActivated.length === 2 && automaticGame.usedCards.length === 2, "開局時應自動啟動所有已裝備的被動寶物");
assert(automaticGame.extraCardClaims === 1 && treasureClaimsForFloor(1, automaticGame.extraCardClaims) === 2, "寶物鑰匙應讓第一層可選兩張寶物");
assert(automaticGame.xpMultiplier === 2, "經驗寶物應在開局時自動生效");
assert(activateAutomaticTreasures(automaticGame, ["treasureKey"], { treasureKey: 1 }).length === 0, "同一張被動寶物每局只能啟動一次");

for (const [cardId, card] of Object.entries(TREASURE_CARDS)) {
  const catalogGame = createGame("easy");
  Object.assign(catalogGame, {
    health: 1,
    maxHealth: 10,
    shields: 0,
    frozenSeconds: 0,
    xpMultiplier: 1,
    extraCardClaims: 0
  });
  const selected = catalogGame.values.findIndex((value) => value === 0);
  catalogGame.selected = selected;
  if (card.effect === "hint") {
    const targets = applyHintTreasure(catalogGame, card, selected);
    assert(targets.length === card.value && targets.every((index) => catalogGame.values[index] === catalogGame.solution[index]), `${cardId} 必須填入正確答案`);
  } else if (card.effect === "revive") {
    assert(strongestEquippedRevive([cardId], { [cardId]: 1 }) === cardId, `${cardId} 必須可被復活流程辨識`);
  } else {
    assert(applyImmediateTreasure(catalogGame, card, { index: selected }), `${cardId} 必須可成功套用效果`);
    if (card.effect === "heal") assert(catalogGame.health === Math.min(10, 1 + card.value), `${cardId} 回血量必須正確`);
    if (card.effect === "shield") assert(catalogGame.shields === card.value, `${cardId} 護盾量必須正確`);
    if (card.effect === "candidates") assert(catalogGame.notes[selected].length > 0, `${cardId} 必須標示候選數字`);
    if (card.effect === "freeze") assert(catalogGame.frozenSeconds === card.value, `${cardId} 凍結秒數必須正確`);
    if (card.effect === "xpBoost") assert(catalogGame.xpMultiplier === card.value, `${cardId} XP 倍率必須正確`);
    if (card.effect === "extraClaim") assert(treasureClaimsForFloor(2, catalogGame.extraCardClaims) === card.value, `${cardId} 必須增加選卡次數`);
  }
}

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key)
};
const saveProgress = { playerId: "5e2b1c42-fc62-4f58-9f01-29ded0bab4d2", playerName: "阿霖", level: 7, xp: 42, coins: 88, floors: { easy: 9, medium: 4, hard: 2 }, inventory: { dragonElixir: 1 }, cardCollection: ["dragonElixir"] };
const saveSession = { game: { ...createGame("easy"), floor: 9 }, equippedCards: ["dragonElixir"], alinMode: false };
const saveCode = exportSaveCode(saveProgress, saveSession);
const imported = importSaveCode(saveCode);
assert(imported.progress.level === 7 && imported.progress.floors.easy === 9, "存檔碼應還原等級與層數");
assert(imported.progress.playerName === "阿霖" && imported.progress.playerId === saveProgress.playerId, "存檔碼應還原玩家名稱與匿名 ID");
assert(imported.session.game.floor === 9 && imported.session.equippedCards[0] === "dragonElixir", "存檔碼應還原目前關卡與裝備");
assert(validCloudPin("0428") && !validCloudPin("123") && !validCloudPin("12a4"), "家庭 PIN 必須是 4 位數字");
assert(normalizePlayerName("  新阿霖\n") === "新阿霖" && normalizePlayerName("島".repeat(20)).length === 16, "雲端玩家名稱應清理控制字元並限制為 16 字");
assert(leaderboardConfigured(), "Supabase 專案設定後排行榜應啟用雲端模式");
const score = buildScore(imported.progress, { difficulty: "easy", floor: 9, stars: 3, elapsed: 120, mistakes: 0 });
assert(score.p_player_name === "阿霖" && score.p_floor === 9 && score.p_score > 90000, "排行榜成績應包含玩家、層數與計算分數");
assert(buildScore(imported.progress, { difficulty: "hard", floor: 3, stars: 2, elapsed: 300, mistakes: 4 }, true).p_difficulty === "alin", "阿霖模式成績應送往獨立排行榜");
assert(normalizeLeaderboardTaunt("  榜首是我的！\n  ") === "榜首是我的！", "排行榜嗆聲應移除控制字元與前後空白");
assert(normalizeLeaderboardTaunt("哈".repeat(60)).length === 48, "排行榜嗆聲應限制為 48 字");
const achievementRun = recordAchievementGame({ ...imported.progress, completedGames: 5, totalStars: 20, coins: 0, achievements: [], achievementStats: {} }, { perfect: true, speed: true, alin: true });
assert(achievementRun.unlocked.some((item) => item.id === "fiveClears") && achievementRun.unlocked.some((item) => item.id === "starCollector"), "累計局數與星星應解鎖永久成就");
assert(achievementRun.progress.achievementStats.perfectGames === 1 && achievementRun.progress.coins > 0, "完賽統計與成就金幣應永久累積");
assert(recordAchievementGame(achievementRun.progress).unlocked.length === 0, "已解鎖成就不可重複領取");
assert(achievementValue(achievementRun.progress, ACHIEVEMENTS.find((item) => item.id === "firstPerfect")) === 1, "成就圖鑑應顯示正確進度");
console.log("核心規則測試通過");
