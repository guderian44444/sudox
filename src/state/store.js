const STORAGE_KEY = "sudox-progress-v1";

const defaultProgress = {
  level: 1,
  xp: 0,
  coins: 20,
  streak: 0,
  completedGames: 0,
  unlockedDifficulty: "easy"
};

export function loadProgress() {
  try {
    return { ...defaultProgress, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return { ...defaultProgress };
  }
}

export function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function rewardProgress(progress, xpReward) {
  const next = { ...progress };
  next.xp += xpReward;
  next.coins += Math.ceil(xpReward / 5);
  next.completedGames += 1;
  next.streak += 1;
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
