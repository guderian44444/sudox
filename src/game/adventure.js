export const ADVENTURE_RULES = {
  easy: { maxHealth: 5, treasurePoolSize: 10 },
  medium: { maxHealth: 4, treasurePoolSize: 30 },
  hard: { maxHealth: 3, treasurePoolSize: 60 }
};

const definitions = [
  ["heartPotion", "愛心藥水", "💗", 1, "common", "heal", 1, "回復 1 顆心"],
  ["shield", "守護盾牌", "🛡️", 1, "common", "shield", 1, "獲得 1 層護盾"],
  ["candidateLens", "候選放大鏡", "🔎", 1, "common", "candidates", 1, "顯示目前格的候選數字"],
  ["smartHint", "精靈提示", "🧚", 1, "rare", "hint", 1, "免費完成目前格"],
  ["hourglass", "時光沙漏", "⏳", 1, "rare", "freeze", 60, "暫停計時 60 秒"],
  ["revive", "復活羽毛", "🪶", 1, "rare", "revive", 2, "失敗時恢復 2 顆心"],
  ["luckyStar", "幸運星", "🌟", 1, "rare", "xpBoost", 2, "本局 XP 加倍"],
  ["treasureKey", "寶箱鑰匙", "🗝️", 1, "legendary", "extraClaim", 1, "過關時多帶走 1 張卡"],
  ["twinHeart", "雙心莓果", "🍓", 1, "common", "heal", 2, "回復 2 顆心"],
  ["woodenCharm", "木靈護符", "🪵", 1, "common", "shield", 1, "獲得 1 層護盾"],

  ["moonPotion", "月露藥水", "🌙", 2, "rare", "heal", 2, "回復 2 顆心"],
  ["ironWall", "鋼鐵壁壘", "🧱", 2, "rare", "shield", 2, "獲得 2 層護盾"],
  ["oracleLens", "先知單眼鏡", "🧐", 2, "rare", "candidates", 1, "標出目前格候選數字"],
  ["fairyGuide", "花園精靈", "🧚‍♀️", 2, "rare", "hint", 1, "免費完成目前格"],
  ["clockFlower", "時計花", "🌺", 2, "rare", "freeze", 90, "暫停計時 90 秒"],
  ["phoenixAsh", "鳳凰灰燼", "🔥", 2, "rare", "revive", 3, "失敗時恢復 3 顆心"],
  ["cometBadge", "彗星徽章", "☄️", 2, "rare", "xpBoost", 2, "本局 XP 加倍"],
  ["silverKey", "銀月鑰匙", "🔑", 2, "legendary", "extraClaim", 1, "過關時多帶走 1 張卡"],
  ["forestDew", "森林晨露", "💧", 2, "common", "heal", 1, "回復 1 顆心"],
  ["crystalBuckler", "水晶圓盾", "🔷", 2, "rare", "shield", 2, "獲得 2 層護盾"],
  ["owlMap", "貓頭鷹地圖", "🦉", 2, "rare", "candidates", 1, "標出目前格候選數字"],
  ["runeChalk", "符文粉筆", "✍️", 2, "rare", "hint", 1, "免費完成目前格"],
  ["snowGlobe", "靜止雪景球", "❄️", 2, "rare", "freeze", 120, "暫停計時 120 秒"],
  ["sunMedal", "太陽勳章", "☀️", 2, "rare", "xpBoost", 2, "本局 XP 加倍"],
  ["cloudFeather", "雲端羽毛", "☁️", 2, "rare", "revive", 2, "失敗時恢復 2 顆心"],
  ["shellHorn", "潮汐螺號", "🐚", 2, "common", "heal", 2, "回復 2 顆心"],
  ["emeraldLeaf", "翡翠葉片", "🍃", 2, "rare", "shield", 2, "獲得 2 層護盾"],
  ["amberBee", "琥珀蜜蜂", "🐝", 2, "rare", "xpBoost", 1.75, "本局 XP 提升 75%"],
  ["blueLantern", "藍焰提燈", "🏮", 2, "rare", "hint", 1, "免費完成目前格"],
  ["starCompass", "星路羅盤", "🧭", 2, "legendary", "extraClaim", 1, "過關時多帶走 1 張卡"],

  ["dragonElixir", "龍心靈藥", "🐉", 3, "legendary", "heal", 4, "回復 4 顆心"],
  ["aegis", "天穹神盾", "🏛️", 3, "legendary", "shield", 3, "獲得 3 層護盾"],
  ["truthMirror", "真理之鏡", "🪞", 3, "legendary", "candidates", 1, "標出目前格候選數字"],
  ["sageCrown", "賢者之冠", "👑", 3, "legendary", "hint", 2, "免費完成 2 格"],
  ["eternityClock", "永恆懷錶", "⌚", 3, "legendary", "freeze", 180, "暫停計時 180 秒"],
  ["phoenixCrown", "鳳凰王冠", "🦅", 3, "legendary", "revive", 4, "失敗時恢復 4 顆心"],
  ["galaxyCore", "銀河核心", "🌌", 3, "legendary", "xpBoost", 3, "本局 XP 變為三倍"],
  ["goldKey", "黃金王鑰", "🔐", 3, "legendary", "extraClaim", 2, "過關時多帶走 2 張卡"],
  ["rainbowDrop", "彩虹精華", "🌈", 3, "rare", "heal", 3, "回復 3 顆心"],
  ["titanShield", "泰坦巨盾", "🗿", 3, "legendary", "shield", 4, "獲得 4 層護盾"],
  ["seerOrb", "星象水晶球", "🔮", 3, "legendary", "candidates", 1, "標出目前格候選數字"],
  ["voidQuill", "虛空羽筆", "🖋️", 3, "legendary", "hint", 2, "免費完成 2 格"],
  ["frostCrown", "霜時王冠", "🧊", 3, "legendary", "freeze", 240, "暫停計時 240 秒"],
  ["kingMedal", "群星勳章", "🎖️", 3, "legendary", "xpBoost", 2.5, "本局 XP 提升 150%"],
  ["angelWing", "天使羽翼", "🪽", 3, "legendary", "revive", 4, "失敗時恢復 4 顆心"],
  ["thunderDrum", "雷神戰鼓", "🥁", 3, "rare", "shield", 3, "獲得 3 層護盾"],
  ["worldTreeLeaf", "世界樹葉", "🌿", 3, "legendary", "heal", 5, "完全回復生命"],
  ["royalHoney", "皇家蜂蜜", "🍯", 3, "rare", "heal", 3, "回復 3 顆心"],
  ["spiritLantern", "萬靈提燈", "🏮", 3, "legendary", "hint", 3, "免費完成 3 格"],
  ["destinyCompass", "命運羅盤", "🧭", 3, "legendary", "extraClaim", 2, "過關時多帶走 2 張卡"],
  ["mermaidPearl", "人魚珍珠", "🫧", 3, "rare", "heal", 3, "回復 3 顆心"],
  ["volcanoHeart", "火山之心", "🌋", 3, "legendary", "xpBoost", 2.5, "本局 XP 提升 150%"],
  ["auroraRibbon", "極光緞帶", "🎀", 3, "rare", "freeze", 180, "暫停計時 180 秒"],
  ["ancientTablet", "遠古數碑", "🪨", 3, "legendary", "hint", 2, "免費完成 2 格"],
  ["unicornHorn", "獨角獸角", "🦄", 3, "legendary", "heal", 5, "完全回復生命"],
  ["meteorShard", "隕星碎片", "💫", 3, "legendary", "xpBoost", 3, "本局 XP 變為三倍"],
  ["timeGem", "時間寶石", "💎", 3, "legendary", "freeze", 300, "暫停計時 300 秒"],
  ["guardianTotem", "島嶼守護像", "🗽", 3, "legendary", "shield", 5, "獲得 5 層護盾"],
  ["islandCrown", "數獨島王冠", "🏝️", 3, "legendary", "extraClaim", 2, "過關時多帶走 2 張卡"],
  ["sudokuRelic", "九宮聖物", "9️⃣", 3, "legendary", "hint", 3, "免費完成 3 格"]
];

export const TREASURE_CARDS = Object.fromEntries(definitions.map(([id, name, icon, tier, rarity, effect, value, description]) => [id, {
  name, icon, tier, rarity, effect, value, description
}]));

export const TREASURE_EFFECTS = Object.freeze(["heal", "shield", "candidates", "hint", "freeze", "revive", "xpBoost", "extraClaim"]);
export const TREASURE_AUTO_EFFECTS = Object.freeze(["xpBoost", "extraClaim"]);

export function completedSudokuUnits(values = []) {
  if (!Array.isArray(values) || values.length !== 81) return { rows: [], columns: [], boxes: [] };
  const rows = Array.from({ length: 9 }, (_, row) => row)
    .filter((row) => values.slice(row * 9, row * 9 + 9).every(Boolean));
  const columns = Array.from({ length: 9 }, (_, column) => column)
    .filter((column) => Array.from({ length: 9 }, (_, row) => values[row * 9 + column]).every(Boolean));
  const boxes = Array.from({ length: 9 }, (_, box) => box)
    .filter((box) => {
      const startRow = Math.floor(box / 3) * 3;
      const startCol = (box % 3) * 3;
      return Array.from({ length: 9 }, (_, offset) => values[(startRow + Math.floor(offset / 3)) * 9 + startCol + (offset % 3)]).every(Boolean);
    });
  return { rows, columns, boxes };
}

export function newlyCompletedSudokuUnits(values, completedUnits = {}) {
  const completed = completedSudokuUnits(values);
  const knownRows = Array.isArray(completedUnits.rows) ? completedUnits.rows : [];
  const knownColumns = Array.isArray(completedUnits.columns) ? completedUnits.columns : [];
  const knownBoxes = Array.isArray(completedUnits.boxes) ? completedUnits.boxes : [];
  return {
    rows: completed.rows.filter((row) => !knownRows.includes(row)),
    columns: completed.columns.filter((column) => !knownColumns.includes(column)),
    boxes: completed.boxes.filter((box) => !knownBoxes.includes(box))
  };
}

export function sudokuUnitCells(type, unitIndex, variant = 0) {
  const reverse = variant === 1;
  if (type === "row") {
    const cells = Array.from({ length: 9 }, (_, column) => unitIndex * 9 + column);
    return reverse ? cells.reverse() : cells;
  }
  if (type === "column") {
    const cells = Array.from({ length: 9 }, (_, row) => row * 9 + unitIndex);
    return reverse ? cells.reverse() : cells;
  }
  if (type === "box") {
    const startRow = Math.floor(unitIndex / 3) * 3;
    const startCol = (unitIndex % 3) * 3;
    const offsets = reverse ? [0, 1, 2, 5, 8, 7, 6, 3, 4] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    return offsets.map((offset) => (startRow + Math.floor(offset / 3)) * 9 + startCol + (offset % 3));
  }
  return [];
}

export function strongestEquippedRevive(equippedCards = [], inventory = {}) {
  return equippedCards
    .filter((cardId) => TREASURE_CARDS[cardId]?.effect === "revive" && inventory[cardId] > 0)
    .sort((left, right) => TREASURE_CARDS[right].value - TREASURE_CARDS[left].value)[0];
}

export function applyImmediateTreasure(game, card, { alinMode = false, index = game?.selected } = {}) {
  if (!game || !card) return false;
  if (card.effect === "heal") {
    if (alinMode || game.health >= game.maxHealth) return false;
    game.health = Math.min(game.maxHealth, game.health + card.value);
  } else if (card.effect === "shield") game.shields += card.value;
  else if (card.effect === "candidates") {
    if (!Number.isInteger(index) || game.values[index]) return false;
    game.notes[index] = candidatesFor(game.values, index);
  } else if (card.effect === "freeze") game.frozenSeconds += card.value;
  else if (card.effect === "xpBoost") {
    game.xpMultiplier *= card.value;
  } else if (card.effect === "extraClaim") {
    game.extraCardClaims += card.value;
  } else return false;
  return true;
}

export function activateAutomaticTreasures(game, equippedCards = [], inventory = {}, options = {}) {
  if (!Array.isArray(game.usedCards)) game.usedCards = [];
  const activated = [];
  equippedCards.forEach((cardId) => {
    const card = TREASURE_CARDS[cardId];
    if (!card || !TREASURE_AUTO_EFFECTS.includes(card.effect) || !inventory[cardId] || game.usedCards.includes(cardId)) return;
    if (!applyImmediateTreasure(game, card, options)) return;
    game.usedCards.push(cardId);
    activated.push(cardId);
  });
  return activated;
}

export function applyHintTreasure(game, card, index = game?.selected) {
  if (!game || card?.effect !== "hint") return [];
  const targets = [];
  if (Number.isInteger(index) && !game.puzzle[index] && !game.values[index]) targets.push(index);
  const otherEmptyCells = game.values
    .map((value, cell) => !value && !game.puzzle[cell] && cell !== index ? cell : -1)
    .filter((cell) => cell >= 0);
  while (targets.length < card.value && otherEmptyCells.length) {
    targets.push(otherEmptyCells.splice(Math.floor(Math.random() * otherEmptyCells.length), 1)[0]);
  }
  targets.forEach((target) => {
    game.values[target] = game.solution[target];
    game.notes[target] = [];
  });
  return targets;
}

export function treasureClaimsForFloor(floor, extraClaims = 0) {
  const baseClaim = floor === 1 || floor % 3 === 0 ? 1 : 0;
  return baseClaim + Math.max(0, Math.floor(extraClaims));
}

const cardIds = Object.keys(TREASURE_CARDS);

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function treasurePool(difficulty) {
  const size = ADVENTURE_RULES[difficulty]?.treasurePoolSize || 10;
  return cardIds.slice(0, size);
}

export function drawTreasureCards(difficulty, stars, count = 3) {
  const pool = treasurePool(difficulty);
  const common = pool.filter((id) => TREASURE_CARDS[id].rarity === "common");
  const special = pool.filter((id) => TREASURE_CARDS[id].rarity !== "common");
  const choices = new Set();
  const specialChance = stars === 1 ? 0.18 : stars === 2 ? 0.42 : 0.68;
  if (stars >= 2 && special.length) choices.add(randomItem(special));
  while (choices.size < Math.min(count, pool.length)) {
    const source = special.length && Math.random() < specialChance ? special : common.length ? common : pool;
    choices.add(randomItem(source));
  }
  return [...choices];
}

export function calculateStars(game) {
  let stars = 1;
  if (game.mistakes <= 1) stars += 1;
  if (game.mistakes === 0 && game.hintsUsed === 0) stars += 1;
  return stars;
}

export function candidatesFor(values, index) {
  if (values[index]) return [];
  const row = Math.floor(index / 9);
  const col = index % 9;
  const used = new Set();
  for (let i = 0; i < 9; i += 1) {
    used.add(values[row * 9 + i]);
    used.add(values[i * 9 + col]);
  }
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let r = startRow; r < startRow + 3; r += 1) {
    for (let c = startCol; c < startCol + 3; c += 1) used.add(values[r * 9 + c]);
  }
  return Array.from({ length: 9 }, (_, number) => number + 1).filter((number) => !used.has(number));
}
