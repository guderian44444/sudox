export const ACHIEVEMENTS = Object.freeze([
  { id: "firstClear", icon: "🌱", name: "小島第一步", description: "累計完成 1 局", stat: "completedGames", target: 1, coins: 10 },
  { id: "fiveClears", icon: "🧭", name: "島嶼探險家", description: "累計完成 5 局", stat: "completedGames", target: 5, coins: 20 },
  { id: "twentyClears", icon: "⛵", name: "數獨航海家", description: "累計完成 20 局", stat: "completedGames", target: 20, coins: 40 },
  { id: "fiftyClears", icon: "👑", name: "小島傳說", description: "累計完成 50 局", stat: "completedGames", target: 50, coins: 80 },
  { id: "starCollector", icon: "⭐", name: "摘星收藏家", description: "累計獲得 20 顆星", stat: "totalStars", target: 20, coins: 20 },
  { id: "starMaster", icon: "🌟", name: "百星島主", description: "累計獲得 100 顆星", stat: "totalStars", target: 100, coins: 60 },
  { id: "firstPerfect", icon: "💎", name: "完美解題", description: "零失誤且不用提示完成 1 局", stat: "perfectGames", target: 1, coins: 20 },
  { id: "tenPerfect", icon: "🏵️", name: "完美主義者", description: "完美完成 10 局", stat: "perfectGames", target: 10, coins: 60 },
  { id: "fiveSpeed", icon: "⚡", name: "乘風破浪", description: "取得時間獎勵 5 次", stat: "speedGames", target: 5, coins: 30 },
  { id: "fiveAlin", icon: "🌈", name: "阿霖好朋友", description: "用阿霖模式完成 5 局", stat: "alinGames", target: 5, coins: 30 }
]);

const statValue = (progress, stat) => stat in progress
  ? Math.max(0, Number(progress[stat]) || 0)
  : Math.max(0, Number(progress.achievementStats?.[stat]) || 0);

export function achievementValue(progress, achievement) {
  return Math.min(achievement.target, statValue(progress, achievement.stat));
}

export function recordAchievementGame(progress, { perfect = false, speed = false, alin = false } = {}) {
  const stats = {
    perfectGames: Math.max(0, Number(progress.achievementStats?.perfectGames) || 0) + (perfect ? 1 : 0),
    speedGames: Math.max(0, Number(progress.achievementStats?.speedGames) || 0) + (speed ? 1 : 0),
    alinGames: Math.max(0, Number(progress.achievementStats?.alinGames) || 0) + (alin ? 1 : 0)
  };
  const achievements = Array.isArray(progress.achievements) ? [...new Set(progress.achievements)] : [];
  const next = { ...progress, achievementStats: stats, achievements };
  const unlocked = ACHIEVEMENTS.filter((achievement) => !achievements.includes(achievement.id) && statValue(next, achievement.stat) >= achievement.target);
  unlocked.forEach((achievement) => {
    achievements.push(achievement.id);
    next.coins += achievement.coins;
  });
  return { progress: next, unlocked };
}
