/**
 * Pure-ish run-loop rules for a single adventure game.
 * Mutates the game object and returns structured events for the UI layer.
 */
import { DIFFICULTIES, relatedCells } from "./sudoku.js";
import {
  ADVENTURE_RULES,
  calculateStars,
  completedSudokuUnits,
  drawTreasureCards,
  newlyCompletedSudokuUnits,
  treasureClaimsForFloor
} from "./adventure.js";

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

export const UNIT_LABELS = Object.freeze({
  row: (unitIndex) => `第 ${unitIndex + 1} 行`,
  column: (unitIndex) => `第 ${unitIndex + 1} 直列`,
  box: (unitIndex) => `第 ${unitIndex + 1} 宮`
});

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
    equippedCards: [...equippedCards],
    usedCards: [],
    cardChoices: [],
    claimedCards: [],
    remainingClaims: 0,
    started: false
  };
}

export function applyAdventureSetup(game, equippedCards = []) {
  Object.assign(game, createAdventureFields(game.difficulty, equippedCards));
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
