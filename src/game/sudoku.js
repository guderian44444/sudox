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

export function solveSudoku(values) {
  const grid = [...values];
  const findEmpty = () => grid.findIndex((value) => value === 0);
  const isValid = (index, value) => {
    const row = Math.floor(index / 9);
    const col = index % 9;
    for (let i = 0; i < 9; i += 1) {
      if (grid[row * 9 + i] === value || grid[i * 9 + col] === value) return false;
    }
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let r = startRow; r < startRow + 3; r += 1) {
      for (let c = startCol; c < startCol + 3; c += 1) {
        if (grid[r * 9 + c] === value) return false;
      }
    }
    return true;
  };
  const fill = () => {
    const index = findEmpty();
    if (index === -1) return true;
    for (let value = 1; value <= 9; value += 1) {
      if (!isValid(index, value)) continue;
      grid[index] = value;
      if (fill()) return true;
      grid[index] = 0;
    }
    return false;
  };
  fill();
  return grid;
}

export function countSolutions(values, limit = 2) {
  const grid = [...values];
  let solutions = 0;
  const isValid = (index, value) => {
    const row = Math.floor(index / 9);
    const col = index % 9;
    for (let i = 0; i < 9; i += 1) {
      if (grid[row * 9 + i] === value || grid[i * 9 + col] === value) return false;
    }
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let r = startRow; r < startRow + 3; r += 1) {
      for (let c = startCol; c < startCol + 3; c += 1) {
        if (grid[r * 9 + c] === value) return false;
      }
    }
    return true;
  };
  const search = () => {
    if (solutions >= limit) return;
    const index = grid.findIndex((value) => value === 0);
    if (index === -1) {
      solutions += 1;
      return;
    }
    for (let value = 1; value <= 9; value += 1) {
      if (!isValid(index, value)) continue;
      grid[index] = value;
      search();
      grid[index] = 0;
    }
  };
  search();
  return solutions;
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
