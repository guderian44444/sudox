/**
 * Pure-ish run-loop rules for a single adventure game.
 * Mutates the game object and returns structured events for the UI layer.
 * Also owns the full runtime game factory + session normalization (P2).
 */
import { createGame, DIFFICULTIES, relatedCells } from "./sudoku.js?v=v50";
import {
  ADVENTURE_RULES,
  calculateStars,
  completedSudokuUnits,
  drawTreasureCards,
  newlyCompletedSudokuUnits,
  treasureClaimsForFloor
} from "./adventure.js?v=v50";

const DIFFICULTY_IDS = new Set(Object.keys(DIFFICULTIES));

export const RUN_MILESTONES = Object.freeze([
  { id: "streak15", icon: "🔥", name: "靈感連線", detail: "連續答對 15 格", test: (current) => current.correctStreak >= 15 },
  { id: "filled60", icon: "🧩", name: "拼圖成形", detail: "本局盤面填滿 60 格", test: (current) => current.values.filter(Boolean).length >= 60 },
  { id: "rows3", icon: "↔️", name: "橫行小隊", detail: "完成 3 條橫行", test: (current) => current.completedUnits.rows.length >= 3 },
  { id: "columns3", icon: "↕️", name: "直列登山隊", detail: "完成 3 條縱列", test: (current) => current.completedUnits.columns.length >= 3 },
  { id: "boxes3", icon: "🏘️", name: "九宮守護者", detail: "完成 3 個九宮格", test: (current) => current.completedUnits.boxes.length >= 3 },
  {
    id: "units8",
    icon: "🏝️",
    name: "半島點燈",
    detail: "累計完成 8 個行、列或宮",
    test: (current) => current.completedUnits.rows.length + current.completedUnits.columns.length + current.completedUnits.boxes.length >= 8
  },
  { id: "lastNine", icon: "🚩", name: "最後衝刺", detail: "盤面只剩最後 9 格", test: (current) => current.values.filter(Boolean).length >= 72 }
]);

const MILESTONE_IDS = new Set(RUN_MILESTONES.map((item) => item.id));

export const UNIT_LABELS = Object.freeze({
  row: (unitIndex) => `第 ${unitIndex + 1} 行`,
  column: (unitIndex) => `第 ${unitIndex + 1} 直列`,
  box: (unitIndex) => `第 ${unitIndex + 1} 宮`
});

function clampInt(value, min, max, fallback) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function validGrid(grid, allowZero) {
  return Array.isArray(grid)
    && grid.length === 81
    && grid.every((value) => Number.isInteger(value) && value >= (allowZero ? 0 : 1) && value <= 9);
}

function validNotes(notes) {
  return Array.isArray(notes)
    && notes.length === 81
    && notes.every((cell) => Array.isArray(cell)
      && cell.length <= 9
      && cell.every((note) => Number.isInteger(note) && note >= 1 && note <= 9));
}

function normalizeCardIds(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((id) => typeof id === "string" && /^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(id)))];
}

function normalizeHealGoals(goals = {}) {
  return {
    streak: Boolean(goals?.streak),
    row: Boolean(goals?.row),
    box: Boolean(goals?.box)
  };
}

function normalizeUnitIndexList(list) {
  if (!Array.isArray(list)) return null;
  return [...new Set(list.filter((index) => Number.isInteger(index) && index >= 0 && index <= 8))];
}

function normalizeCompletedUnits(units, values) {
  const actual = completedSudokuUnits(values);
  const pick = (key, claimed) => {
    if (!claimed) return [...actual[key]];
    return claimed.filter((index) => actual[key].includes(index));
  };
  return {
    rows: pick("rows", normalizeUnitIndexList(units?.rows)),
    columns: pick("columns", normalizeUnitIndexList(units?.columns)),
    boxes: pick("boxes", normalizeUnitIndexList(units?.boxes))
  };
}

function normalizeSelected(rawSelected, puzzle, values) {
  if (Number.isInteger(rawSelected) && rawSelected >= 0 && rawSelected < 81 && !puzzle[rawSelected]) {
    return rawSelected;
  }
  const empty = values.findIndex((value, index) => !puzzle[index] && !value);
  if (empty >= 0) return empty;
  const anyEditable = puzzle.findIndex((value) => value === 0);
  return anyEditable >= 0 ? anyEditable : 0;
}

function boardsConsistent(puzzle, solution, values) {
  for (let index = 0; index < 81; index += 1) {
    if (puzzle[index] !== 0 && puzzle[index] !== solution[index]) return false;
    if (puzzle[index] !== 0 && values[index] !== puzzle[index]) return false;
    if (values[index] !== 0 && values[index] !== solution[index] && puzzle[index] === 0) {
      // Player may have wrong values? In this game wrong answers don't write values.
      // So any non-zero editable cell must match solution.
      return false;
    }
  }
  return true;
}

export function createAdventureFields(difficulty, equippedCards = []) {
  const rules = ADVENTURE_RULES[difficulty] || ADVENTURE_RULES.easy;
  return {
    maxHealth: rules.maxHealth,
    health: rules.maxHealth,
    shields: 0,
    failed: false,
    actions: 0,
    correctStreak: 0,
    healGoals: { streak: false, row: false, box: false },
    completedUnits: { rows: [], columns: [], boxes: [] },
    milestones: [],
    hintsUsed: 0,
    frozenSeconds: 0,
    xpMultiplier: 1,
    extraCardClaims: 0,
    equippedCards: normalizeCardIds(equippedCards).slice(0, 2),
    usedCards: [],
    cardChoices: [],
    claimedCards: [],
    remainingClaims: 0,
    started: false
  };
}

/**
 * Build a full playable adventure game in one step (board + adventure + floor).
 */
export function createAdventureGame({
  difficulty = "easy",
  floor = 1,
  equippedCards = []
} = {}) {
  const safeDifficulty = DIFFICULTY_IDS.has(difficulty) ? difficulty : "easy";
  const base = createGame(safeDifficulty);
  return {
    ...base,
    ...createAdventureFields(safeDifficulty, equippedCards),
    floor: clampInt(floor, 1, 1000000, 1)
  };
}

/**
 * Normalize a raw/partial game (session restore, import). Returns null if unusable.
 * @param {object} raw
 * @param {{ allowTerminal?: boolean }} [options] allowTerminal keeps completed/failed games (default false for playable sessions)
 */
export function normalizeRuntimeGame(raw, { allowTerminal = false } = {}) {
  if (!raw || typeof raw !== "object") return null;
  const difficulty = DIFFICULTY_IDS.has(raw.difficulty) ? raw.difficulty : null;
  if (!difficulty) return null;
  if (!validGrid(raw.puzzle, true) || !validGrid(raw.solution, false) || !validGrid(raw.values, true) || !validNotes(raw.notes)) {
    return null;
  }
  if (!boardsConsistent(raw.puzzle, raw.solution, raw.values)) return null;

  const rules = ADVENTURE_RULES[difficulty] || ADVENTURE_RULES.easy;
  const maxHealth = rules.maxHealth;
  const defaults = createAdventureFields(difficulty, raw.equippedCards);
  const completed = Boolean(raw.completed);
  const failed = Boolean(raw.failed);
  if (!allowTerminal && (completed || failed)) return null;

  const health = clampInt(raw.health, 0, maxHealth, failed ? 0 : maxHealth);
  const game = {
    difficulty,
    puzzle: [...raw.puzzle],
    solution: [...raw.solution],
    values: [...raw.values],
    notes: raw.notes.map((cell) => [...new Set(cell)].filter((note) => note >= 1 && note <= 9).sort((a, b) => a - b)),
    selected: normalizeSelected(raw.selected, raw.puzzle, raw.values),
    mistakes: clampInt(raw.mistakes, 0, 9999, 0),
    elapsed: clampInt(raw.elapsed, 0, 10_000_000, 0),
    startedAt: Number.isFinite(Number(raw.startedAt)) ? Number(raw.startedAt) : Date.now(),
    completed,
    failed,
    floor: clampInt(raw.floor, 1, 1000000, 1),
    maxHealth,
    health: failed ? 0 : health,
    shields: clampInt(raw.shields, 0, 99, 0),
    actions: clampInt(raw.actions, 0, 1_000_000, 0),
    correctStreak: clampInt(raw.correctStreak, 0, 81, 0),
    healGoals: normalizeHealGoals(raw.healGoals ?? defaults.healGoals),
    completedUnits: normalizeCompletedUnits(raw.completedUnits, raw.values),
    milestones: Array.isArray(raw.milestones)
      ? [...new Set(raw.milestones.filter((id) => MILESTONE_IDS.has(id)))].slice(0, RUN_MILESTONES.length)
      : [],
    hintsUsed: clampInt(raw.hintsUsed, 0, 81, 0),
    frozenSeconds: clampInt(raw.frozenSeconds, 0, 1_000_000, 0),
    xpMultiplier: (() => {
      const value = Number(raw.xpMultiplier);
      return Number.isFinite(value) && value > 0 && value <= 10 ? value : 1;
    })(),
    extraCardClaims: clampInt(raw.extraCardClaims, 0, 10, 0),
    equippedCards: normalizeCardIds(raw.equippedCards).slice(0, 2),
    usedCards: normalizeCardIds(raw.usedCards).slice(0, 20),
    cardChoices: normalizeCardIds(raw.cardChoices).slice(0, 6),
    claimedCards: normalizeCardIds(raw.claimedCards).slice(0, 6),
    remainingClaims: clampInt(raw.remainingClaims, 0, 10, 0),
    started: typeof raw.started === "boolean" ? raw.started : true
  };

  // Optional reward fields may exist after completion (allowTerminal).
  if (allowTerminal && completed) {
    if (Number.isInteger(raw.stars)) game.stars = clampInt(raw.stars, 1, 3, 1);
    if (Number.isFinite(Number(raw.xpReward))) game.xpReward = Math.max(0, Math.round(Number(raw.xpReward)));
    if (Number.isFinite(Number(raw.timeBonus))) game.timeBonus = Math.max(0, Math.round(Number(raw.timeBonus)));
  }

  return game;
}

/** True when game is a full, playable mid-run object (not completed/failed). */
export function isValidRuntimeGame(game, { allowTerminal = false } = {}) {
  return Boolean(normalizeRuntimeGame(game, { allowTerminal }));
}

/**
 * Validate + normalize a persisted session envelope.
 * @returns {null | { game: object, equippedCards: string[], alinMode: boolean }}
 */
export function normalizeSession(session) {
  if (!session || typeof session !== "object") return null;
  if (session.alinMode != null && typeof session.alinMode !== "boolean") return null;
  if (session.equippedCards != null && !Array.isArray(session.equippedCards)) return null;

  const game = normalizeRuntimeGame(session.game, { allowTerminal: false });
  if (!game) return null;

  const equippedCards = normalizeCardIds(
    session.equippedCards != null ? session.equippedCards : game.equippedCards
  ).slice(0, 2);
  game.equippedCards = equippedCards;

  return {
    game,
    equippedCards,
    alinMode: Boolean(session.alinMode)
  };
}

export function applyAdventureSetup(game, equippedCards = []) {
  const floor = clampInt(game?.floor, 1, 1000000, 1);
  Object.assign(game, createAdventureFields(game.difficulty, equippedCards), { floor });
  return game;
}

export function canEditCell(game, index = game?.selected) {
  return Boolean(
    game
    && game.started
    && !game.completed
    && !game.failed
    && Number.isInteger(index)
    && index >= 0
    && index < 81
    && !game.puzzle[index]
  );
}

export function removeRelatedNotes(game, index, number) {
  relatedCells(index).forEach((cell) => {
    game.notes[cell] = game.notes[cell].filter((note) => note !== number);
  });
}

/**
 * Apply a digit or note on the selected (or given) cell.
 * @returns {{ type: "noop"|"note"|"mistake"|"correct", index?: number, number?: number, blockedByShield?: boolean, failed?: boolean }}
 */
export function applyPlayerDigit(game, number, { noteMode = false, alinMode = false, index = game?.selected } = {}) {
  if (!canEditCell(game, index)) return { type: "noop" };

  if (noteMode) {
    const notes = new Set(game.notes[index]);
    if (notes.has(number)) notes.delete(number);
    else notes.add(number);
    game.notes[index] = [...notes];
    return { type: "note", index, number };
  }

  if (game.solution[index] !== number) {
    game.actions += 1;
    game.mistakes += 1;
    game.correctStreak = 0;
    let blockedByShield = false;
    if (!alinMode) {
      if (game.shields) {
        game.shields -= 1;
        blockedByShield = true;
      } else {
        game.health -= 1;
      }
      if (game.health <= 0) game.failed = true;
    }
    return { type: "mistake", index, number, blockedByShield, failed: Boolean(game.failed) };
  }

  game.actions += 1;
  game.correctStreak += 1;
  game.values[index] = number;
  game.notes[index] = [];
  removeRelatedNotes(game, index, number);
  return { type: "correct", index, number };
}

export function clearEditableCell(game, index = game?.selected) {
  if (!canEditCell(game, index)) return false;
  if (game.values[index] === 0 && !game.notes[index]?.length) return false;
  game.values[index] = 0;
  game.notes[index] = [];
  return true;
}

export function healOrShieldReward(game, alinMode = false) {
  if (alinMode) return "阿霖模式目標達成";
  if (game.health < game.maxHealth) {
    game.health += 1;
    return "回復 1 顆心";
  }
  game.shields += 1;
  return "獲得 1 層護盾";
}

function unitEvent(game, type, unitIndex, alinMode) {
  const goal = type === "row" ? "row" : type === "box" ? "box" : null;
  const firstReward = Boolean(goal && !game.healGoals[goal]);
  let reward = null;
  if (firstReward) {
    game.healGoals[goal] = true;
    reward = healOrShieldReward(game, alinMode);
  }
  return {
    kind: "unit",
    type,
    unitIndex,
    firstReward,
    reward,
    label: UNIT_LABELS[type](unitIndex)
  };
}

/**
 * After a correct fill (or hint), update streak/unit heal goals.
 * @returns {{ newlyCompleted: { rows: number[], columns: number[], boxes: number[] }, events: object[] }}
 */
export function collectBoardProgressEvents(game, alinMode = false) {
  const events = [];
  if (!game.healGoals) game.healGoals = { streak: false, row: false, box: false };

  if (!game.healGoals.streak && game.correctStreak >= 8) {
    game.healGoals.streak = true;
    events.push({
      kind: "healGoal",
      goal: "streak",
      label: "連對 8 格",
      reward: healOrShieldReward(game, alinMode)
    });
  }

  if (!game.completedUnits) game.completedUnits = { rows: [], columns: [], boxes: [] };
  else if (!Array.isArray(game.completedUnits.columns)) {
    game.completedUnits.columns = completedSudokuUnits(game.values).columns;
  }

  const newlyCompleted = newlyCompletedSudokuUnits(game.values, game.completedUnits);
  newlyCompleted.rows.forEach((row) => {
    game.completedUnits.rows.push(row);
    events.push(unitEvent(game, "row", row, alinMode));
  });
  newlyCompleted.columns.forEach((column) => {
    game.completedUnits.columns.push(column);
    events.push(unitEvent(game, "column", column, alinMode));
  });
  newlyCompleted.boxes.forEach((box) => {
    game.completedUnits.boxes.push(box);
    events.push(unitEvent(game, "box", box, alinMode));
  });

  return { newlyCompleted, events };
}

/** @returns {typeof RUN_MILESTONES[number][]} newly reached milestones (game.milestones updated) */
export function collectNewMilestones(game) {
  game.milestones ||= [];
  const unlocked = [];
  RUN_MILESTONES.forEach((milestone) => {
    if (game.milestones.includes(milestone.id) || !milestone.test(game)) return;
    game.milestones.push(milestone.id);
    unlocked.push(milestone);
  });
  return unlocked;
}

export function isBoardSolved(game) {
  return Boolean(game?.values?.every((value, index) => value === game.solution[index]));
}

/**
 * Mark the run complete and attach reward fields on the game object.
 * Does not touch player progress / achievements / leaderboard — UI layer owns those side effects.
 * @returns {null | { stars: number, xpReward: number, timeBonus: number, remainingClaims: number, cardChoices: string[], perfect: boolean, speed: boolean, alin: boolean }}
 */
export function settleCompletedGame(game, { alinMode = false } = {}) {
  if (!game || game.completed || !isBoardSolved(game)) return null;

  game.completed = true;
  const reward = DIFFICULTIES[game.difficulty] || DIFFICULTIES.easy;
  game.stars = calculateStars(game);
  const farmMultiplier = game.floor > 1 ? 0.55 : 1;
  game.xpReward = Math.max(10, Math.round(reward.xp * (game.xpMultiplier || 1) * farmMultiplier));
  game.timeBonus = game.elapsed <= reward.bonusTime ? reward.bonusCoins : 0;
  game.remainingClaims = treasureClaimsForFloor(game.floor, game.extraCardClaims || 0);
  game.cardChoices = game.remainingClaims
    ? drawTreasureCards(game.difficulty, game.stars, Math.max(3, game.remainingClaims))
    : [];

  return {
    stars: game.stars,
    xpReward: game.xpReward,
    timeBonus: game.timeBonus,
    remainingClaims: game.remainingClaims,
    cardChoices: game.cardChoices,
    perfect: game.mistakes === 0 && game.hintsUsed === 0,
    speed: game.timeBonus > 0,
    alin: Boolean(alinMode)
  };
}

export function applyHintFill(game, index = game?.selected) {
  if (!canEditCell(game, index) || game.values[index]) return null;
  const value = game.solution[index];
  game.actions += 1;
  game.hintsUsed = (game.hintsUsed || 0) + 1;
  game.values[index] = value;
  game.notes[index] = [];
  removeRelatedNotes(game, index, value);
  return { index, value };
}

export function canClaimCard(game, cardId) {
  return Boolean(
    game?.completed
    && game.remainingClaims > 0
    && !game.claimedCards.includes(cardId)
    && game.cardChoices.includes(cardId)
  );
}

export function claimRewardCard(game, cardId) {
  if (!canClaimCard(game, cardId)) return false;
  game.claimedCards.push(cardId);
  game.remainingClaims -= 1;
  return true;
}
