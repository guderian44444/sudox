import { countSolutions, createGame, DIFFICULTIES, generatePuzzle, PUZZLES, relatedCells, solveSudoku } from "../src/game/sudoku.js";
import { ADVENTURE_RULES, candidatesFor, drawTreasureCards, treasurePool, TREASURE_CARDS } from "../src/game/adventure.js";
import { validCloudPin } from "../src/state/cloud.js";
import { buildScore, leaderboardConfigured } from "../src/state/leaderboard.js";
import { exportSaveCode, importSaveCode } from "../src/state/store.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
assert(treasurePool("easy").length === 10, "輕鬆難度應使用前 10 種寶物");
assert(treasurePool("medium").length === 30, "動腦難度應使用前 30 種寶物");
assert(treasurePool("hard").length === 60, "高手難度應使用完整 60 種寶物");
assert(new Set(drawTreasureCards("hard", 3)).size === 3, "抽卡選項不可重複");

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
assert(leaderboardConfigured(), "Supabase 專案設定後排行榜應啟用雲端模式");
const score = buildScore(imported.progress, { difficulty: "easy", floor: 9, stars: 3, elapsed: 120, mistakes: 0 });
assert(score.p_player_name === "阿霖" && score.p_floor === 9 && score.p_score > 90000, "排行榜成績應包含玩家、層數與計算分數");
console.log("核心規則測試通過");
