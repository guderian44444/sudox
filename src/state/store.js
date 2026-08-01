const STORAGE_KEY = "sudox-progress-v2";
const LEGACY_STORAGE_KEY = "sudox-progress-v1";

const starterInventory = {
  heartPotion: 1,
  shield: 1,
  candidateLens: 0,
  smartHint: 0,
  hourglass: 0,
  revive: 0,
  luckyStar: 0,
  treasureKey: 0
};

const defaultProgress = {
  level: 1,
  xp: 0,
  coins: 20,
  streak: 0,
  completedGames: 0,
  unlockedDifficulty: "easy",
  inventory: starterInventory,
  cardCollection: [],
  totalStars: 0,
  bestTimes: {},
  rewardedRuns: []
};

export function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "null") || {};
    return {
      ...defaultProgress,
      ...saved,
      inventory: { ...starterInventory, ...(saved.inventory || {}) },
      cardCollection: Array.isArray(saved.cardCollection) ? saved.cardCollection : [],
      bestTimes: saved.bestTimes || {},
      rewardedRuns: Array.isArray(saved.rewardedRuns) ? saved.rewardedRuns : []
    };
  } catch {
    return { ...defaultProgress, inventory: { ...starterInventory } };
  }
}

export function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function addCard(progress, cardId) {
  const next = { ...progress, inventory: { ...progress.inventory }, cardCollection: [...progress.cardCollection] };
  next.inventory[cardId] = (next.inventory[cardId] || 0) + 1;
  if (!next.cardCollection.includes(cardId)) next.cardCollection.push(cardId);
  saveProgress(next);
  return next;
}

export function consumeCard(progress, cardId) {
  if (!progress.inventory[cardId]) return progress;
  const next = { ...progress, inventory: { ...progress.inventory, [cardId]: progress.inventory[cardId] - 1 } };
  saveProgress(next);
  return next;
}

export function spendCoins(progress, amount) {
  if (progress.coins < amount) return progress;
  const next = { ...progress, coins: progress.coins - amount };
  saveProgress(next);
  return next;
}

export function rewardProgress(progress, xpReward, bonusCoins = 0, stars = 0) {
  const next = { ...progress };
  next.xp += xpReward;
  next.coins += Math.ceil(xpReward / 5) + bonusCoins;
  next.completedGames += 1;
  next.streak += 1;
  next.totalStars = (next.totalStars || 0) + stars;
  while (next.xp >= next.level * 100) {
    next.xp -= next.level * 100;
    next.level += 1;
    next.coins += 25;
  }
  if (next.completedGames >= 2) next.unlockedDifficulty = "medium";
  if (next.completedGames >= 5) next.unlockedDifficulty = "hard";
  saveProgress(next);
  return next;
}
