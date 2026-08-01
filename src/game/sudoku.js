export const DIFFICULTIES = {
  easy: { label: "輕鬆", icon: "🌱", xp: 35, hintCost: 5 },
  medium: { label: "動腦", icon: "🌼", xp: 60, hintCost: 8 },
  hard: { label: "高手", icon: "🏆", xp: 100, hintCost: 12 }
};

const PUZZLES = {
  easy: [
    "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
    "200080300060070084030500209000105408000000000402706000301007040720040060004010003"
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

export function createGame(difficulty = "easy") {
  const choices = PUZZLES[difficulty];
  const puzzle = choices[Math.floor(Math.random() * choices.length)].split("").map(Number);
  return {
    difficulty,
    puzzle,
    solution: solveSudoku(puzzle),
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
