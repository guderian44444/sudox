export const ADVENTURE_RULES = {
  easy: { maxHealth: 5 },
  medium: { maxHealth: 4 },
  hard: { maxHealth: 3 }
};

export const TREASURE_CARDS = {
  heartPotion: { name: "愛心藥水", icon: "💗", rarity: "common", description: "回復 1 顆心" },
  shield: { name: "守護盾牌", icon: "🛡️", rarity: "common", description: "抵擋下一次錯誤" },
  candidateLens: { name: "候選放大鏡", icon: "🔎", rarity: "common", description: "顯示目前格的候選數字" },
  smartHint: { name: "精靈提示", icon: "🧚", rarity: "rare", description: "免費完成目前格" },
  hourglass: { name: "時光沙漏", icon: "⏳", rarity: "rare", description: "暫停計時 60 秒" },
  revive: { name: "復活羽毛", icon: "🪶", rarity: "rare", description: "失敗時恢復 2 顆心" },
  luckyStar: { name: "幸運星", icon: "🌟", rarity: "rare", description: "本局 XP 加倍" },
  treasureKey: { name: "寶箱鑰匙", icon: "🗝️", rarity: "legendary", description: "過關時多帶走 1 張卡" }
};

const cardIds = Object.keys(TREASURE_CARDS);

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function drawTreasureCards(stars, count = 3) {
  const common = cardIds.filter((id) => TREASURE_CARDS[id].rarity === "common");
  const rare = cardIds.filter((id) => TREASURE_CARDS[id].rarity === "rare");
  const choices = new Set();
  if (stars >= 2) choices.add(randomItem(rare));
  if (stars >= 3) choices.add(Math.random() < 0.12 ? "treasureKey" : randomItem(rare));
  while (choices.size < count) {
    const rareChance = stars === 1 ? 0.12 : stars === 2 ? 0.35 : 0.55;
    choices.add(randomItem(Math.random() < rareChance ? rare : common));
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
