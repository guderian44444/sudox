export const ACHIEVEMENT_CATEGORIES = Object.freeze([
  { id: "journey", icon: "🏝️", name: "航海歷程" },
  { id: "precision", icon: "💎", name: "精準解題" },
  { id: "independent", icon: "🧠", name: "獨立挑戰" },
  { id: "hard", icon: "🔥", name: "高手挑戰" },
  { id: "special", icon: "⚡", name: "特殊戰績" },
  { id: "modes", icon: "🌈", name: "模式探索" }
]);

const reward = ({ badge, title, boardDecoration, avatarFrame } = {}) => Object.freeze({
  ...(badge ? { badge } : {}),
  ...(title ? { title } : {}),
  ...(boardDecoration ? { boardDecoration } : {}),
  ...(avatarFrame ? { avatarFrame } : {})
});

const ORIGINAL_STAGES = Object.freeze([
  { id: "firstClear", category: "journey", icon: "🌱", name: "小島第一步", description: "累計完成 1 局", stat: "completedGames", target: 1, coins: 10, rewards: reward({ badge: "🌱 新芽勳章" }) },
  { id: "fiveClears", category: "journey", icon: "🧭", name: "島嶼探險家", description: "累計完成 5 局", stat: "completedGames", target: 5, coins: 20, rewards: reward({ badge: "🧭 銅羅盤勳章" }) },
  { id: "twentyClears", category: "journey", icon: "⛵", name: "數獨航海家", description: "累計完成 20 局", stat: "completedGames", target: 20, coins: 40, rewards: reward({ badge: "⛵ 銀帆勳章", title: "數獨航海家" }) },
  { id: "fiftyClears", category: "journey", icon: "👑", name: "小島傳說", description: "累計完成 50 局", stat: "completedGames", target: 50, coins: 80, rewards: reward({ badge: "👑 金冠勳章", title: "小島傳說" }) },
  { id: "hundredClears", category: "journey", icon: "🏅", name: "百戰島主", description: "累計完成 100 局", stat: "completedGames", target: 100, coins: 0, rewards: reward({ badge: "🏅 白金勳章", title: "百戰島主" }) },
  { id: "twoFiftyClears", category: "journey", icon: "🗺️", name: "海圖畫滿", description: "累計完成 250 局", stat: "completedGames", target: 250, coins: 0, rewards: reward({ badge: "🗺️ 海圖勳章", boardDecoration: "🗺️ 世界海圖" }) },
  { id: "fiveHundredClears", category: "journey", icon: "👑", name: "永不靠岸", description: "累計完成 500 局", stat: "completedGames", target: 500, coins: 0, rewards: reward({ badge: "👑 傳說勳章", title: "數獨島傳說", avatarFrame: "👑 傳說金框" }) },
  { id: "starCollector", category: "journey", icon: "⭐", name: "摘星收藏家", description: "累計獲得 20 顆星", stat: "totalStars", target: 20, coins: 20, rewards: reward({ badge: "⭐ 星砂勳章" }) },
  { id: "starMaster", category: "journey", icon: "🌟", name: "百星島主", description: "累計獲得 100 顆星", stat: "totalStars", target: 100, coins: 60, rewards: reward({ badge: "🌟 百星勳章", boardDecoration: "✨ 星光角飾" }) },

  { id: "firstPerfect", category: "precision", icon: "💎", name: "完美解題", description: "零失誤且不用提示完成 1 局", stat: "perfectGames", target: 1, coins: 20, rewards: reward({ badge: "💎 水晶勳章" }) },
  { id: "tenPerfect", category: "precision", icon: "🏵️", name: "完美主義者", description: "完美完成 10 局", stat: "perfectGames", target: 10, coins: 60, rewards: reward({ badge: "🏵️ 水晶花環", title: "完美主義者" }) },
  { id: "firstNoMistake", category: "precision", icon: "🎯", name: "一筆不差", description: "零失誤完成 1 局", stat: "noMistakeGames", target: 1, coins: 0, rewards: reward({ badge: "🎯 靶心勳章" }) },
  { id: "tenNoMistake", category: "precision", icon: "🎯", name: "精準航手", description: "零失誤完成 10 局", stat: "noMistakeGames", target: 10, coins: 0, rewards: reward({ badge: "🎯 銀色準星勳章" }) },
  { id: "fiftyNoMistake", category: "precision", icon: "🔷", name: "零誤差", description: "零失誤完成 50 局", stat: "noMistakeGames", target: 50, coins: 0, rewards: reward({ badge: "🔷 零誤差勳章", title: "零誤差", boardDecoration: "💠 水晶角飾" }) },

  { id: "firstNoHint", category: "independent", icon: "🧠", name: "自己來", description: "不用提示完成 1 局", stat: "noHintGames", target: 1, coins: 0, rewards: reward({ badge: "🧠 小腦袋勳章" }) },
  { id: "tenNoHint", category: "independent", icon: "🧭", name: "不問路的人", description: "不用提示完成 10 局", stat: "noHintGames", target: 10, coins: 0, rewards: reward({ badge: "🧭 自立羅盤勳章", title: "獨立解題者" }) },
  { id: "fiftyNoHint", category: "independent", icon: "🗼", name: "無人領航", description: "不用提示完成 50 局", stat: "noHintGames", target: 50, coins: 0, rewards: reward({ badge: "🗼 燈塔勳章", title: "無人領航", boardDecoration: "🗼 小島燈塔" }) },
  { id: "firstBarehand", category: "independent", icon: "🎒", name: "空手上島", description: "不裝寶物完成 1 局", stat: "barehandGames", target: 1, coins: 0, rewards: reward({ badge: "🎒 空背包勳章" }) },
  { id: "tenBarehand", category: "independent", icon: "🪶", name: "裸裝航海家", description: "不裝寶物完成 10 局", stat: "barehandGames", target: 10, coins: 0, rewards: reward({ badge: "🪶 輕裝勳章", title: "裸裝航海家" }) },
  { id: "fiftyBarehand", category: "independent", icon: "⚔️", name: "兩手空空的大師", description: "不裝寶物完成 50 局", stat: "barehandGames", target: 50, coins: 0, rewards: reward({ badge: "⚔️ 空手大師勳章", boardDecoration: "◻️ 極簡棋盤飾" }) },
  { id: "firstPure", category: "independent", icon: "🌟", name: "純粹解題", description: "零失誤、零提示、零寶物完成 1 局", stat: "pureGames", target: 1, coins: 0, rewards: reward({ badge: "🌟 純金九宮勳章" }) },
  { id: "tenPure", category: "independent", icon: "🏵️", name: "純粹十勝", description: "純粹解題完成 10 局", stat: "pureGames", target: 10, coins: 0, rewards: reward({ badge: "🏵️ 純粹花環", title: "純粹派", boardDecoration: "✨ 金線角飾" }) },
  { id: "fiftyPure", category: "independent", icon: "👑", name: "孤高島主", description: "純粹解題完成 50 局", stat: "pureGames", target: 50, coins: 0, rewards: reward({ badge: "👑 孤高勳章", title: "孤高島主", boardDecoration: "🖤 黑金棋盤框" }) },

  { id: "tenHard", category: "hard", icon: "🔥", name: "高手登島", description: "高手模式完成 10 局", stat: "hardGames", target: 10, coins: 0, rewards: reward({ badge: "🔥 赤焰勳章" }) },
  { id: "hardPure", category: "hard", icon: "🗡️", name: "數獨劍聖", description: "高手模式純粹解題完成 1 局", stat: "hardPureGames", target: 1, coins: 0, rewards: reward({ badge: "🗡️ 劍聖勳章", title: "數獨劍聖" }) },
  { id: "hardNoNotes", category: "hard", icon: "✏️", name: "腦內草稿", description: "高手模式全程不用筆記完成 1 局", stat: "hardNoNoteGames", target: 1, coins: 0, rewards: reward({ badge: "✏️ 折斷鉛筆勳章" }) },
  { id: "tenHardNoNotes", category: "hard", icon: "🧠", name: "心算航路", description: "高手模式不用筆記完成 10 局", stat: "hardNoNoteGames", target: 10, coins: 0, rewards: reward({ badge: "🧠 心算勳章", title: "腦內棋盤", boardDecoration: "🧠 腦內棋盤飾" }) },

  { id: "fiveSpeed", category: "special", icon: "⚡", name: "乘風破浪", description: "取得時間獎勵 5 次", stat: "speedGames", target: 5, coins: 30, rewards: reward({ badge: "⚡ 閃電勳章" }) },
  { id: "firstHardSpeed", category: "special", icon: "⚡", name: "閃電靠岸", description: "高手模式取得時間獎勵 1 次", stat: "hardSpeedGames", target: 1, coins: 0, rewards: reward({ badge: "⚡ 赤雷勳章" }) },
  { id: "tenHardSpeed", category: "special", icon: "🌩️", name: "雷霆船長", description: "高手模式取得時間獎勵 10 次", stat: "hardSpeedGames", target: 10, coins: 0, rewards: reward({ badge: "🌩️ 雷霆勳章", title: "雷霆船長", boardDecoration: "⚡ 雷電角飾" }) },
  { id: "lastHeartClear", category: "special", icon: "❤️‍🔥", name: "最後一顆心", description: "一般模式曾剩 1 心且未復活，成功通關 1 次", stat: "lastHeartGames", target: 1, coins: 0, rewards: reward({ badge: "❤️‍🔥 燃心勳章" }) },
  { id: "tenLastHeart", category: "special", icon: "⚓", name: "不沉之船", description: "一般模式曾剩 1 心且未復活，成功通關 10 次", stat: "lastHeartGames", target: 10, coins: 0, rewards: reward({ badge: "⚓ 不沉勳章", title: "不沉之船", boardDecoration: "⚓ 船錨角飾" }) },

  { id: "fiveAlin", category: "modes", icon: "🌈", name: "阿霖好朋友", description: "用阿霖模式完成 5 局", stat: "alinGames", target: 5, coins: 30, rewards: reward({ badge: "🌈 彩虹勳章", title: "阿霖好朋友" }) },
  { id: "fourModes", category: "modes", icon: "🌍", name: "四海通行", description: "四種模式各完成至少 1 局", stat: "modeMinimumGames", target: 1, coins: 0, rewards: reward({ badge: "🌍 四色羅盤勳章" }) },
  { id: "fourModesVeteran", category: "modes", icon: "🌈", name: "四海老手", description: "四種模式各完成至少 20 局", stat: "modeMinimumGames", target: 20, coins: 0, rewards: reward({ badge: "🌈 四海勳章", title: "四海制霸", avatarFrame: "🌈 彩虹頭像框" }) }
]);

const COMMON_TARGETS = [1, 5, 10, 20, 50, 100];
// A stage keeps its original ID and coin reward; all added stages reward cosmetics only.
const SERIES_DEFINITIONS = [
  ["voyage", "航海歷程", "journey", "🧭", "completedGames", "累計完成 {n} 局", "各難度與阿霖模式皆計入。", ["初次啟航", "島嶼探險家", "十里海風", "數獨航海家", "小島傳說", "百戰島主", "海圖畫滿", "永不靠岸"], [...COMMON_TARGETS, 250, 500]],
  ["stars", "星光收藏", "journey", "⭐", "totalStars", "累計獲得 {n} 顆星", "每次通關得到的星星都會累積。", ["點亮第一星", "掌心星砂", "十星小夜曲", "摘星收藏家", "銀河漫步", "百星島主", "星圖繪師", "繁星守望者"], [...COMMON_TARGETS, 250, 500]],
  ["perfect", "完美解題", "precision", "💎", "perfectGames", "零失誤且不用答案提示完成 {n} 局", "可用筆記；非答案提示類寶物可用。", ["完美解題", "五顆水晶", "完美主義者", "澄澈之眼", "無瑕花園", "百鍊晶冠"]],
  ["accuracy", "精準航線", "precision", "🎯", "noMistakeGames", "零失誤完成 {n} 局", "可以使用筆記、提示與寶物。", ["一筆不差", "穩穩五航", "精準航手", "百步穿楊", "零誤差", "不偏不倚"]],
  ["selfReliant", "獨立解題", "independent", "🗼", "noHintGames", "不用答案提示完成 {n} 局", "免費提示及填答案寶物都算提示；筆記與候選寶物可用。", ["自己來", "自力五航", "不問路的人", "尋路之光", "無人領航", "百航燈塔"]],
  ["barehand", "輕裝上島", "independent", "🪶", "barehandGames", "不裝備、不使用寶物且未復活完成 {n} 局", "自動寶物、金幣復活也不符合；一般提示與筆記可用。", ["空手上島", "輕裝五步", "裸裝航海家", "清風行者", "兩手空空的大師", "無裝備的傳說"]],
  ["pure", "純粹挑戰", "independent", "🌟", "pureGames", "零失誤、零答案提示、零寶物且未復活完成 {n} 局", "允許手動筆記，靠自己的推理完成。", ["純粹解題", "澄心五勝", "純粹十勝", "金線推理家", "孤高島主", "純粹百鍊"]],
  ["hard", "高手遠航", "hard", "🔥", "hardGames", "一般高手模式完成 {n} 局", "阿霖模式獨立計算，不計入一般高手。", ["初登高峰", "五峰踏浪", "高手登島", "赤焰航路", "巔峰船長", "百峰征服者"]],
  ["hardPure", "劍聖修行", "hard", "🗡️", "hardPureGames", "一般高手模式純粹解題完成 {n} 局", "零錯、零答案提示、零寶物、未復活；手動筆記可用。", ["數獨劍聖", "五式劍意", "十勝劍豪", "破浪劍心", "無雙劍聖", "百鍊無鋒"]],
  ["mental", "腦內棋盤", "hard", "🧠", "hardNoNoteGames", "一般高手模式不用筆記、候選輔助或答案提示完成 {n} 局", "候選寶物及寫過又擦掉的筆記也會記錄。", ["腦內草稿", "五重心圖", "心算航路", "心眼開圖", "無紙棋士", "百局心海"]],
  ["speed", "乘風航行", "special", "⚡", "speedGames", "取得時間獎勵 {n} 次", "休閒速度成就；依各難度時間門檻，允許時間與提示寶物。", ["初借東風", "乘風破浪", "十陣海風", "疾風領航", "追風船長", "百帆逐日"]],
  ["hardSpeed", "雷霆航路", "special", "🌩️", "hardSpeedGames", "一般高手模式取得時間獎勵 {n} 次", "休閒速度成就；時間與提示寶物可用，阿霖不計入。", ["閃電靠岸", "五道赤雷", "雷霆船長", "奔雷航手", "風暴領主", "百雷之冠"]],
  ["lastHeart", "逆風靠岸", "special", "⚓", "lastHeartGames", "一般模式曾剩 1 心且未復活，成功通關 {n} 次", "自然遇到危機再挑戰即可；曾歸零復活的局不計入。", ["最後一顆心", "五次逆風", "不沉之船", "逆浪舵手", "堅心船長", "百航不墜"]],
  ["alin", "彩虹同行", "modes", "🌈", "alinGames", "阿霖模式完成 {n} 局", "阿霖的輕鬆、動腦、高手都算本系列。", ["彩虹初遇", "阿霖好朋友", "十回同行", "彩虹領航員", "五十道彩虹", "百日晴光"]],
  ["allModes", "四海探索", "modes", "🌍", "modeMinimumGames", "輕鬆、動腦、高手、阿霖各完成 {n} 局", "取四模式中最少的完成數；不以舊層數猜測歷史。", ["四海通行", "四海小隊", "四海熟客", "四海老手", "四海探險王", "四海百航"]]
];
const COLORS = ["#8b6a40", "#ae6d3e", "#557791", "#7760a6", "#b18120", "#347b79", "#545198", "#986b14"];
export const ACHIEVEMENT_SERIES = Object.freeze(SERIES_DEFINITIONS.map(([id, name, category, icon, stat, condition, rule, names, targets = COMMON_TARGETS]) => ({
  id, name, category, icon, stat, rule,
  stages: targets.map((target, index) => {
    const original = ORIGINAL_STAGES.find((stage) => stage.stat === stat && stage.target === target);
    const stageName = original?.name || names[index];
    const rewards = original?.rewards || reward({
      badge: `${icon} ${stageName}勳章`,
      ...(target >= 10 ? { title: stageName } : {}),
      ...([5, 100].includes(target) ? { avatarFrame: `${stageName}頭像框` } : {}),
      ...([20, 50].includes(target) ? { boardDecoration: `${stageName}角飾` } : {})
    });
    return Object.freeze({ ...original, id: original?.id || `${id}${target}`, category, icon: original?.icon || icon,
      name: stageName, description: condition.replace("{n}", target), stat, target, coins: original?.coins || 0,
      rewards, seriesId: id, tier: index + 1, color: COLORS[index], rule });
  })
})));
export const ACHIEVEMENTS = Object.freeze(ACHIEVEMENT_SERIES.flatMap((series) => series.stages));
const BY_ID = new Map(ACHIEVEMENTS.map((stage) => [stage.id, stage]));
const MODES = ["easy", "medium", "hard", "alin"];
const STAT_LIMITS = Object.freeze({ completedGames: 500, totalStars: 500, perfectGames: 100, speedGames: 100, alinGames: 100,
  noMistakeGames: 100, noHintGames: 100, barehandGames: 100, pureGames: 100, hardGames: 100,
  hardPureGames: 100, hardNoNoteGames: 100, hardSpeedGames: 100, lastHeartGames: 100, easyGames: 100, mediumGames: 100 });
const numeric = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const validProof = (id) => typeof id === "string" && /^[a-zA-Z0-9:-]{1,164}$/.test(id);
export const achievementById = (id) => BY_ID.get(id) || null;
export const normalizeAchievementIds = (ids) => [...new Set((Array.isArray(ids) ? ids : []).filter((id) => BY_ID.has(id)))];

function legacyStats(progress) {
  const saved = progress.achievementStats || {};
  const base = Object.fromEntries(Object.keys(STAT_LIMITS).map((key) => [key, numeric(saved[key])]));
  base.completedGames = numeric(progress.completedGames);
  base.totalStars = numeric(progress.totalStars);
  for (const id of normalizeAchievementIds(progress.achievements)) {
    const stage = BY_ID.get(id);
    if (stage.stat === "modeMinimumGames") {
      for (const mode of MODES) base[`${mode}Games`] = Math.max(base[`${mode}Games`], stage.target);
    } else base[stage.stat] = Math.max(base[stage.stat], stage.target);
  }
  base.noMistakeGames = Math.max(base.noMistakeGames, base.perfectGames);
  base.noHintGames = Math.max(base.noHintGames, base.perfectGames);
  // Only explicit counters prove a mode. Legacy floors can include older Alin contamination.
  for (const mode of MODES) base[`${mode}Games`] = Math.max(base[`${mode}Games`], numeric(saved.modeGames?.[mode]));
  return base;
}

export function normalizeAchievementEvidence(progress = {}) {
  const raw = progress.achievementEvidence;
  const migrated = raw?.version === 2;
  const legacy = migrated ? null : legacyStats(progress);
  const base = {}, proofs = {};
  for (const [stat, limit] of Object.entries(STAT_LIMITS)) {
    base[stat] = migrated ? numeric(raw.base?.[stat]) : legacy[stat];
    const list = migrated && Array.isArray(raw.proofs?.[stat]) ? raw.proofs[stat] : [];
    // ponytail: proofs stop at the highest catalog goal; raise limits before adding higher goals.
    // Keep a deterministic bounded set of proofs for each finite achievement goal.
    // Union + smallest K is associative/idempotent and cannot lose progress below that goal.
    proofs[stat] = [...new Set(list.filter(validProof))].sort().slice(0, Math.max(0, limit - base[stat]));
  }
  return { version: 2, base, proofs };
}

function evidenceStats(evidence) {
  const stats = Object.fromEntries(Object.keys(STAT_LIMITS).map((stat) => [stat, evidence.base[stat] + evidence.proofs[stat].length]));
  stats.modeGames = Object.fromEntries(MODES.map((mode) => [mode, stats[`${mode}Games`]]));
  return stats;
}

export function normalizeAchievementStats(progress = {}) {
  return evidenceStats(normalizeAchievementEvidence(progress));
}

export function mergeAchievementEvidence(primary, secondary) {
  const left = normalizeAchievementEvidence(primary), right = normalizeAchievementEvidence(secondary);
  return normalizeAchievementEvidence({ achievementEvidence: { version: 2,
    base: Object.fromEntries(Object.keys(STAT_LIMITS).map((key) => [key, Math.max(left.base[key], right.base[key])])),
    proofs: Object.fromEntries(Object.keys(STAT_LIMITS).map((key) => [key, [...left.proofs[key], ...right.proofs[key]]]))
  } });
}

export function achievementValue(progress, stage, stats = normalizeAchievementStats(progress)) {
  if (!stage) return 0;
  const value = stage.stat === "modeMinimumGames" ? Math.min(...Object.values(stats.modeGames))
    : Math.max(stats[stage.stat] || 0, ["completedGames", "totalStars"].includes(stage.stat) ? numeric(progress[stage.stat]) : 0);
  return Math.min(stage.target, value);
}

export function achievementSeriesProgress(progress, series, stats = normalizeAchievementStats(progress)) {
  const unlocked = new Set(progress.achievements || []);
  const earned = series.stages.filter((stage) => unlocked.has(stage.id));
  const next = series.stages.find((stage) => !unlocked.has(stage.id)) || null;
  return { earned, next, current: earned.at(-1) || null, value: achievementValue(progress, next || series.stages.at(-1), stats) };
}

export function achievementRewardText(stage) {
  if (!stage) return "";
  return [stage.coins ? `🪙 +${stage.coins}` : "", stage.rewards.badge,
    stage.rewards.title ? `稱號「${stage.rewards.title}」` : "",
    stage.rewards.boardDecoration, stage.rewards.avatarFrame].filter(Boolean).join("・");
}

const EQUIPMENT_FIELDS = { title: "equippedTitle", boardDecoration: "equippedBoardDecoration", avatarFrame: "equippedAvatarFrame", badge: "equippedBadge" };
export function equippedAchievementReward(progress, type) {
  const stage = BY_ID.get(progress?.[EQUIPMENT_FIELDS[type]]);
  return stage?.rewards[type] && progress.achievements?.includes(stage.id) ? { achievement: stage, label: stage.rewards[type] } : null;
}
export function equipAchievementReward(progress, type, id) {
  const field = EQUIPMENT_FIELDS[type];
  if (!field) return progress;
  if (!id) return { ...progress, [field]: "" };
  const stage = BY_ID.get(id);
  return stage?.rewards[type] && progress.achievements?.includes(id) ? { ...progress, [field]: id } : progress;
}
export function normalizeAchievementEquipment(progress) {
  return Object.fromEntries(Object.entries(EQUIPMENT_FIELDS).map(([type, field]) => [field, equippedAchievementReward(progress, type)?.achievement.id || ""]));
}

export function recordAchievementGame(progress, context = null) {
  let evidence = normalizeAchievementEvidence(progress);
  if (context && Object.keys(context).length) {
    const mode = context.alin ? "alin" : MODES.includes(context.mode) ? context.mode : context.difficulty;
    const perfect = Boolean(context.perfect);
    const noMistake = context.noMistake == null ? perfect : Boolean(context.noMistake);
    const noHint = context.noHint == null ? perfect : Boolean(context.noHint);
    const pure = Boolean(context.pure);
    const increments = { completedGames: 1, totalStars: Math.min(3, numeric(context.stars)), perfectGames: +perfect,
      noMistakeGames: +noMistake, noHintGames: +noHint, barehandGames: +Boolean(context.barehand), pureGames: +pure,
      speedGames: +Boolean(context.speed), lastHeartGames: +Boolean(context.lastHeart),
      hardPureGames: +(mode === "hard" && pure), hardNoNoteGames: +(mode === "hard" && Boolean(context.noNotes)),
      hardSpeedGames: +(mode === "hard" && Boolean(context.speed)) };
    if (MODES.includes(mode)) increments[`${mode}Games`] = 1;
    for (const [stat, amount] of Object.entries(increments)) {
      if (!amount) continue;
      if (validProof(context.runId)) {
        for (let i = 0; i < amount; i++) evidence.proofs[stat].push(stat === "totalStars" ? `${context.runId}:${i + 1}` : context.runId);
      } else if (!["completedGames", "totalStars"].includes(stat)) {
        // Compatibility for legacy callers; live settlements always supply a persistent runId.
        evidence.base[stat] += amount;
      }
    }
    evidence = normalizeAchievementEvidence({ achievementEvidence: evidence });
  }
  const stats = evidenceStats(evidence);
  const achievements = normalizeAchievementIds(progress.achievements);
  const next = { ...progress, achievementEvidence: evidence, achievementStats: stats, achievements,
    completedGames: Math.max(numeric(progress.completedGames), stats.completedGames), totalStars: Math.max(numeric(progress.totalStars), stats.totalStars) };
  const unlocked = ACHIEVEMENTS.filter((stage) => !achievements.includes(stage.id) && achievementValue(next, stage, stats) >= stage.target);
  for (const stage of unlocked) { achievements.push(stage.id); next.coins = numeric(next.coins) + stage.coins; }
  Object.assign(next, normalizeAchievementEquipment(next));
  return { progress: next, unlocked, changed: JSON.stringify(next) !== JSON.stringify(progress) };
}
