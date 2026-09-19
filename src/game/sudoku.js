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
function searchSolutions(values, limit, rules = {}, nodeLimit = Infinity) {
  if (!validSudokuGrid(values)) return { count: 0, solution: null };
  const constraints = rules.variant && rules.variant !== "classic" ? compileVariant(rules) : null;
  if (constraints && !values.every((value, index) => !value || extraCandidateMask(values, index, constraints) & (1 << value))) return { count: 0, solution: null };
  const grid = [...values];
  const rows = Array(9).fill(0), columns = Array(9).fill(0), boxes = Array(9).fill(0);
  const empty = [];
  grid.forEach((value, index) => {
    const row = Math.floor(index / 9), column = index % 9, box = Math.floor(row / 3) * 3 + Math.floor(column / 3);
    if (!value) empty.push({ index, row, column, box });
    else { rows[row] |= 1 << value; columns[column] |= 1 << value; boxes[box] |= 1 << value; }
  });
  let count = 0, solution = null, nodes = 0, exhausted = false;
  function search(depth) {
    if (count >= limit || exhausted) return;
    if (++nodes > nodeLimit) { exhausted = true; return; }
    if (depth === empty.length) { count++; solution ||= [...grid]; return; }
    let best = depth, mask = 0, fewest = 10;
    for (let i = depth; i < empty.length; i++) {
      const { index, row, column, box } = empty[i];
      const candidates = (constraints ? extraCandidateMask(grid, index, constraints) : 0x3fe) & ~(rows[row] | columns[column] | boxes[box]);
      let bits = candidates, size = 0;
      while (bits) { bits &= bits - 1; size++; }
      if (size < fewest) { best = i; mask = candidates; fewest = size; }
      if (size <= 1) break;
    }
    if (!mask) return;
    [empty[depth], empty[best]] = [empty[best], empty[depth]];
    const { index, row, column, box } = empty[depth];
    while (mask && count < limit && !exhausted) {
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
  return { count: exhausted ? -1 : count, solution };
}

export function solveSudoku(values, rules = {}) {
  return searchSolutions(values, 1, rules).solution || [...values];
}

export function countSolutions(values, limit = 2, rules = {}) {
  return searchSolutions(values, Math.max(1, Math.floor(limit) || 2), rules).count;
}

export function createGame(difficulty = "easy", variant = "classic") {
  const generated = variant === "classic" ? generatePuzzle(difficulty) : generateVariantPuzzle(difficulty, variant);
  const { puzzle, solution } = generated;
  return {
    difficulty,
    variant,
    thermometers: generated.thermometers || [],
    cages: generated.cages || [],
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

export function relatedCells(index, rules = {}) {
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
  if (rules.variant === "diagonal") {
    if (row === col) for (let i = 0; i < 9; i++) related.add(i * 10);
    if (row + col === 8) for (let i = 0; i < 9; i++) related.add(i * 8 + 8);
  }
  if (rules.variant === "thermo") for (const path of rules.thermometers || []) if (path.includes(index)) path.forEach(cell => related.add(cell));
  if (rules.variant === "killer") for (const cage of rules.cages || []) if (cage.cells.includes(index)) cage.cells.forEach(cell => related.add(cell));
  return related;
}


export const VARIANTS = Object.freeze({
  classic: { label: "經典", icon: "🔢", rule: "每行、每列及每個九宮格，填入 1–9 且不重複。" },
  diagonal: { label: "對角線", icon: "╳", rule: "沿用經典規則，兩條標示的對角線也必須各有 1–9，不可重複。" },
  thermo: { label: "溫度計", icon: "🌡️", rule: "沿用經典規則，從圓球往溫度計末端，數字必須嚴格遞增，不必連號。" },
  killer: { label: "Killer", icon: "Σ", rule: "沿用經典規則，每個虛線籠內數字不重複，總和等於籠左上角的小數字。" }
});
const ALL_DIGITS = 0x3fe;
const neighbors = (cell) => [cell - 9, cell + 9, ...(cell % 9 ? [cell - 1] : []), ...(cell % 9 < 8 ? [cell + 1] : [])].filter(index => index >= 0 && index < 81);
const adjacent = (a, b) => neighbors(a).includes(b);
const digitCombinations = new Map();
function sumMasks(size, sum) {
  const key = `${size}:${sum}`;
  if (!digitCombinations.has(key)) {
    const masks = [];
    for (let mask = 2; mask <= ALL_DIGITS; mask += 2) {
      let count = 0, total = 0;
      for (let digit = 1; digit <= 9; digit++) if (mask & (1 << digit)) { count++; total += digit; }
      if (count === size && total === sum) masks.push(mask);
    }
    digitCombinations.set(key, masks);
  }
  return digitCombinations.get(key);
}

// Classic keys stay compatible with existing scores; each variant has its own difficulty and assist board.
export function gameModeKey(variant = "classic", difficulty = "easy", alinMode = false) {
  if (!Object.hasOwn(VARIANTS, variant) || !Object.hasOwn(DIFFICULTIES, difficulty)) return null;
  return variant === "classic" ? (alinMode ? "alin" : difficulty) : `${variant}_${difficulty}${alinMode ? "_alin" : ""}`;
}

export const RANKING_KEYS = Object.freeze(["easy", "medium", "hard", "alin", ...["diagonal", "thermo", "killer"].flatMap(variant =>
  Object.keys(DIFFICULTIES).flatMap(difficulty => [gameModeKey(variant, difficulty), gameModeKey(variant, difficulty, true)]))]);

export function parseGameModeKey(key) {
  if (!RANKING_KEYS.includes(key)) return null;
  if (key === "alin") return { variant: "classic", difficulty: "alin", assisted: true };
  const [variant, difficulty, assist] = key.split("_");
  return difficulty ? { variant, difficulty, assisted: assist === "alin" } : { variant: "classic", difficulty: key, assisted: false };
}

// Reject malformed or incomplete variant saves rather than silently loading a classic board.
export function normalizeVariantRules(raw = {}) {
  const variant = raw.variant ?? "classic";
  if (!Object.hasOwn(VARIANTS, variant)) return null;
  const validCells = cells => Array.isArray(cells) && cells.every(cell => Number.isInteger(cell) && cell >= 0 && cell < 81) && new Set(cells).size === cells.length;
  let thermometers = [], cages = [];
  if (variant === "thermo") {
    if (!Array.isArray(raw.thermometers) || !raw.thermometers.length || raw.thermometers.length > 12) return null;
    for (const path of raw.thermometers) {
      if (!validCells(path) || path.length < 2 || path.length > 9 || !path.every((cell, i) => !i || adjacent(cell, path[i - 1]))) return null;
      thermometers.push([...path]);
    }
  }
  if (variant === "killer") {
    if (!Array.isArray(raw.cages) || !raw.cages.length || raw.cages.length > 81) return null;
    const occupied = new Set();
    for (const cage of raw.cages) {
      if (!cage || !validCells(cage.cells) || !cage.cells.length || cage.cells.length > 9 || !Number.isInteger(cage.sum) || cage.sum < 1 || cage.sum > 45 || !sumMasks(cage.cells.length, cage.sum).length) return null;
      const seen = new Set([cage.cells[0]]), queue = [cage.cells[0]];
      for (const cell of queue) for (const next of neighbors(cell)) if (cage.cells.includes(next) && !seen.has(next)) { seen.add(next); queue.push(next); }
      if (seen.size !== cage.cells.length || cage.cells.some(cell => occupied.has(cell))) return null;
      cage.cells.forEach(cell => occupied.add(cell));
      cages.push({ cells: [...cage.cells].sort((a, b) => a - b), sum: cage.sum });
    }
    if (occupied.size !== 81) return null;
  }
  return { variant, thermometers, cages };
}

function compileVariant(rules) {
  const peers = Array.from({ length: 81 }, () => []);
  const thermos = Array.from({ length: 81 }, () => []), cages = Array(81).fill(null);
  if (rules.variant === "diagonal") {
    for (const cells of [Array.from({ length: 9 }, (_, i) => i * 10), Array.from({ length: 9 }, (_, i) => i * 8 + 8)]) {
      for (const cell of cells) peers[cell].push(...cells.filter(index => index !== cell));
    }
  }
  if (rules.variant === "thermo") for (const path of rules.thermometers) path.forEach((cell, position) => thermos[cell].push({ path, position }));
  if (rules.variant === "killer") for (const cage of rules.cages) {
    const entry = { ...cage, masks: sumMasks(cage.cells.length, cage.sum) };
    cage.cells.forEach(cell => { cages[cell] = entry; });
  }
  return { peers, thermos, cages };
}

function extraCandidateMask(values, index, constraints) {
  let mask = ALL_DIGITS;
  for (const cell of constraints.peers[index]) mask &= ~(1 << values[cell]);
  for (const { path, position } of constraints.thermos[index]) {
    let min = position + 1, max = 9 - (path.length - 1 - position);
    path.forEach((cell, other) => {
      if (!values[cell] || other === position) return;
      if (other < position) min = Math.max(min, values[cell] + position - other);
      else max = Math.min(max, values[cell] - other + position);
    });
    for (let digit = 1; digit <= 9; digit++) if (digit < min || digit > max) mask &= ~(1 << digit);
  }
  const cage = constraints.cages[index];
  if (cage) {
    let used = 0, possible = 0;
    for (const cell of cage.cells) {
      if (cell === index || !values[cell]) continue;
      const bit = 1 << values[cell];
      if (used & bit) return 0;
      used |= bit;
    }
    for (const combination of cage.masks) if ((combination & used) === used) possible |= combination;
    mask &= possible & ~used;
  }
  return mask;
}

export function candidatesForCell(values, index, rules = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= 81 || values[index]) return [];
  let mask = ALL_DIGITS;
  for (const cell of relatedCells(index)) mask &= ~(1 << values[cell]);
  if (rules.variant && rules.variant !== "classic") mask &= extraCandidateMask(values, index, compileVariant(rules));
  return Array.from({ length: 9 }, (_, i) => i + 1).filter(digit => mask & (1 << digit));
}

export function validVariantGrid(values, rules, allowZero = true) {
  if (!validSudokuGrid(values, allowZero)) return false;
  const normalized = normalizeVariantRules(rules);
  if (!normalized) return false;
  if (normalized.variant === "classic") return true;
  const constraints = compileVariant(normalized);
  return values.every((value, index) => !value || Boolean(extraCandidateMask(values, index, constraints) & (1 << value)));
}

function createThermometers(solution) {
  const paths = [], occupied = new Set();
  for (const start of shuffled(Array.from({ length: 81 }, (_, i) => i))) {
    if (occupied.has(start) || solution[start] > 5) continue;
    const path = [start];
    while (path.length < 5) {
      const options = shuffled(neighbors(path.at(-1))).filter(cell => !occupied.has(cell) && !path.includes(cell) && solution[cell] > solution[path.at(-1)]);
      if (!options.length) break;
      path.push(options[0]);
    }
    if (path.length >= 3) { paths.push(path); path.forEach(cell => occupied.add(cell)); }
    if (paths.length >= 6) break;
  }
  return paths;
}

export function generateVariantPuzzle(difficulty = "easy", variant = "classic") {
  if (!Object.hasOwn(VARIANTS, variant)) throw new Error("不支援的數獨玩法");
  if (variant === "classic") return { ...generatePuzzle(difficulty), variant, thermometers: [], cages: [] };
  let solution = createSolvedGrid();
  const rules = { variant, thermometers: [], cages: [] };
  if (variant === "diagonal") {
    const seed = [...shuffled([1,2,3,4,5,6,7,8,9]), ...Array(72).fill(0)];
    solution = searchSolutions(seed, 1, rules).solution;
  } else if (variant === "thermo") {
    rules.thermometers = createThermometers(solution);
    if (!rules.thermometers.length) throw new Error("溫度計出題失敗，請重試");
  }
  if (variant === "killer") {
    // Start with singleton cages and merge only when the cage-only puzzle stays unique.
    rules.cages = solution.map((sum, cell) => ({ cells: [cell], sum }));
    // ponytail: size/count set the difficulty; no technique-based difficulty rating yet.
    const sizeLimit = { easy: 3, medium: 4, hard: 5 }[difficulty] || 3;
    const target = { easy: 38, medium: 30, hard: 26 }[difficulty] || 38;
    const edges = shuffled(Array.from({ length: 81 }, (_, cell) => neighbors(cell).filter(other => other > cell).map(other => [cell, other])).flat());
    for (const [a, b] of edges) {
      if (rules.cages.length <= target) break;
      const left = rules.cages.find(cage => cage.cells.includes(a)), right = rules.cages.find(cage => cage.cells.includes(b));
      if (left === right || left.cells.length + right.cells.length > sizeLimit) continue;
      const cells = [...left.cells, ...right.cells].sort((a,b) => a-b);
      if (new Set(cells.map(cell => solution[cell])).size !== cells.length) continue;
      const previous = rules.cages;
      rules.cages = [...previous.filter(cage => cage !== left && cage !== right), { cells, sum: left.sum + right.sum }];
      // A budget overrun is unknown, never evidence of uniqueness. Generation runs in a worker.
      if (searchSolutions(Array(81).fill(0), 2, rules, 4000).count !== 1) rules.cages = previous;
    }
    return { puzzle: Array(81).fill(0), solution, ...rules };
  }
  const puzzle = [...solution], target = CLUE_TARGETS[difficulty] || CLUE_TARGETS.easy;
  let clues = 81;
  for (const index of shuffled(Array.from({ length:81 }, (_,i) => i))) {
    if (clues <= target) break;
    puzzle[index] = 0;
    if (searchSolutions(puzzle, 2, rules, 10000).count === 1) clues--;
    else puzzle[index] = solution[index];
  }
  return { puzzle, solution, ...rules };
}
