// All listed difficulties are playable from the first game (no unlock progression).
export const DIFFICULTIES = {
  easy: { label: "輕鬆", icon: "🌱", xp: 35, hintCost: 0, bonusTime: 480, bonusCoins: 5 },
  medium: { label: "動腦", icon: "🌼", xp: 60, hintCost: 8, bonusTime: 720, bonusCoins: 8 },
  hard: { label: "高手", icon: "🏆", xp: 100, hintCost: 12, bonusTime: 1080, bonusCoins: 12 }
};

export const PLAYABLE_DIFFICULTIES = Object.freeze(Object.keys(DIFFICULTIES));

/** @returns {boolean} always true for known difficulties — free choice product rule */
export function isDifficultyPlayable(difficulty) {
  return Object.hasOwn(DIFFICULTIES, difficulty);
}

export const PUZZLES = {
  easy: [
    "004070912600105048190040507859001020026800701703920050060537004207019600040206170",
    "005080376100203084830060209976005030013400607402730050090657002708049100050802790"
  ],
  medium: [
    "000260701680070090190004500820100040004602900050003028009300074040050036703018000",
    "000000907000420180000705026100904000050000040000507009920108000034059000507000000"
  ],
  hard: [
    "300000000005009000200504000020000700160000058704310600000890100000067080000005437",
    "000900002050123400030000160908000000070000090000000205091000050007439020400007000"
  ]
};

const CLUE_TARGETS = { easy: 45, medium: 34, hard: 28 };

function shuffled(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function createSolvedGrid() {
  const pattern = (row, col) => (row * 3 + Math.floor(row / 3) + col) % 9;
  const rows = shuffled([0, 1, 2]).flatMap((band) => shuffled([0, 1, 2]).map((row) => band * 3 + row));
  const cols = shuffled([0, 1, 2]).flatMap((stack) => shuffled([0, 1, 2]).map((col) => stack * 3 + col));
  const numbers = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  return rows.flatMap((row) => cols.map((col) => numbers[pattern(row, col)]));
}

export function generatePuzzle(difficulty = "easy") {
  const solution = createSolvedGrid();
  const puzzle = [...solution];
  const targetClues = CLUE_TARGETS[difficulty] || CLUE_TARGETS.easy;
  const rowBlanks = Array(9).fill(0);
  const colBlanks = Array(9).fill(0);

  for (const index of shuffled(Array.from({ length: 81 }, (_, cell) => cell))) {
    if (puzzle.filter(Boolean).length <= targetClues) break;
    const row = Math.floor(index / 9);
    const col = index % 9;
    if (difficulty === "easy" && (rowBlanks[row] >= 4 || colBlanks[col] >= 4)) continue;
    const value = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions(puzzle) !== 1) {
      puzzle[index] = value;
      continue;
    }
    rowBlanks[row] += 1;
    colBlanks[col] += 1;
  }

  return { puzzle, solution };
}

export function validSudokuGrid(values, allowZero = true) {
  if (!Array.isArray(values) || values.length !== 81) return false;
  const rows = Array(9).fill(0), columns = Array(9).fill(0), boxes = Array(9).fill(0);
  return values.every((value, index) => {
    if (!Number.isInteger(value) || value < (allowZero ? 0 : 1) || value > 9) return false;
    if (!value) return true;
    const row = Math.floor(index / 9), column = index % 9, box = Math.floor(row / 3) * 3 + Math.floor(column / 3);
    const bit = 1 << value;
    if ((rows[row] | columns[column] | boxes[box]) & bit) return false;
    rows[row] |= bit; columns[column] |= bit; boxes[box] |= bit;
    return true;
  });
}

// Choose the most constrained cell first; share one solver for generation and validation.
function searchSolutions(values, limit) {
  if (!validSudokuGrid(values)) return { count: 0, solution: null };
  const grid = [...values];
  const rows = Array(9).fill(0), columns = Array(9).fill(0), boxes = Array(9).fill(0);
  const empty = [];
  grid.forEach((value, index) => {
    const row = Math.floor(index / 9), column = index % 9, box = Math.floor(row / 3) * 3 + Math.floor(column / 3);
    if (!value) empty.push({ index, row, column, box });
    else { rows[row] |= 1 << value; columns[column] |= 1 << value; boxes[box] |= 1 << value; }
  });
  let count = 0, solution = null;
  function search(depth) {
    if (count >= limit) return;
    if (depth === empty.length) { count++; solution ||= [...grid]; return; }
    let best = depth, mask = 0, fewest = 10;
    for (let i = depth; i < empty.length; i++) {
      const { row, column, box } = empty[i];
      const candidates = 0x3fe & ~(rows[row] | columns[column] | boxes[box]);
      let bits = candidates, size = 0;
      while (bits) { bits &= bits - 1; size++; }
      if (size < fewest) { best = i; mask = candidates; fewest = size; }
      if (size <= 1) break;
    }
    if (!mask) return;
    [empty[depth], empty[best]] = [empty[best], empty[depth]];
    const { index, row, column, box } = empty[depth];
    while (mask && count < limit) {
      const bit = mask & -mask; mask ^= bit;
      grid[index] = Math.log2(bit);
      rows[row] |= bit; columns[column] |= bit; boxes[box] |= bit;
      search(depth + 1);
      rows[row] ^= bit; columns[column] ^= bit; boxes[box] ^= bit;
    }
    grid[index] = 0;
    [empty[depth], empty[best]] = [empty[best], empty[depth]];
  }
  search(0);
  return { count, solution };
}

export function solveSudoku(values) {
  return searchSolutions(values, 1).solution || [...values];
}

export function countSolutions(values, limit = 2) {
  return searchSolutions(values, Math.max(1, Math.floor(limit) || 2)).count;
}

export function createGame(difficulty = "easy") {
  const { puzzle, solution } = generatePuzzle(difficulty);
  return {
    difficulty,
    puzzle,
    solution,
    values: [...puzzle],
    notes: Array.from({ length: 81 }, () => []),
    selected: puzzle.findIndex((value) => value === 0),
    mistakes: 0,
    elapsed: 0,
    startedAt: Date.now(),
    completed: false
  };
}

export function relatedCells(index) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const related = new Set();
  for (let i = 0; i < 9; i += 1) {
    related.add(row * 9 + i);
    related.add(i * 9 + col);
  }
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let r = startRow; r < startRow + 3; r += 1) {
    for (let c = startCol; c < startCol + 3; c += 1) related.add(r * 9 + c);
  }
  return related;
}
