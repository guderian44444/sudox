import { createGame, DIFFICULTIES, relatedCells, solveSudoku } from "../src/game/sudoku.js";

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

for (const difficulty of Object.keys(DIFFICULTIES)) {
  const game = createGame(difficulty);
  assert(game.values.length === 81, `${difficulty} 盤面必須有 81 格`);
  assert(game.puzzle.some((value) => value === 0), `${difficulty} 題目必須包含空格`);
  assert(validSolution(game.solution), `${difficulty} 解答不符合數獨規則`);
  game.puzzle.forEach((value, index) => {
    assert(!value || value === game.solution[index], `${difficulty} 題目與解答不一致`);
  });
}

assert(solveSudoku(Array(81).fill(0)).every(Boolean), "解題器應可完成空盤面");
assert(relatedCells(40).size === 21, "中央格應包含 21 個同行、同列與同宮格子");
console.log("核心規則測試通過");
