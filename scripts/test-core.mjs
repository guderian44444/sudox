import { countSolutions, createGame, DIFFICULTIES, PUZZLES, relatedCells, solveSudoku } from "../src/game/sudoku.js";
import { ADVENTURE_RULES, candidatesFor, drawTreasureCards, TREASURE_CARDS } from "../src/game/adventure.js";

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
}

assert(solveSudoku(Array(81).fill(0)).every(Boolean), "解題器應可完成空盤面");
assert(relatedCells(40).size === 21, "中央格應包含 21 個同行、同列與同宮格子");
assert(ADVENTURE_RULES.easy.maxHealth > ADVENTURE_RULES.medium.maxHealth, "輕鬆難度血量應高於動腦");
assert(ADVENTURE_RULES.medium.maxHealth > ADVENTURE_RULES.hard.maxHealth, "動腦難度血量應高於高手");
assert(Object.keys(TREASURE_CARDS).length === 8, "第二階段應提供 8 種寶物卡");
assert(new Set(drawTreasureCards(3)).size === 3, "抽卡選項不可重複");
console.log("核心規則測試通過");
