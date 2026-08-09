const ability = (id, name, icon, timeMultiplier, tags, description) => Object.freeze({
  id,
  name,
  icon,
  timeMultiplier,
  tags: Object.freeze(tags),
  description
});

export const COMPANION_ABILITIES = Object.freeze({
  cat: ability("cat", "靈巧佈置", "🐾", 0.7, ["decoration", "craft"], "裝飾與手作工程時間縮短 30%"),
  dog: ability("dog", "可靠跑腿", "🦴", 0.8, ["utility", "commerce"], "公共服務與商業設施時間縮短 20%"),
  mouse: ability("mouse", "精密巧手", "🧰", 0.65, ["craft", "factory"], "工藝與機械設施時間縮短 35%"),
  hamster: ability("hamster", "儲糧達人", "🌾", 0.7, ["farming", "food"], "農業與食品設施時間縮短 30%"),
  rabbit: ability("rabbit", "飛快耕作", "🥕", 0.6, ["farming"], "農業設施時間縮短 40%"),
  fox: ability("fox", "聰明經商", "🧮", 0.7, ["commerce", "coffee"], "商業與咖啡設施時間縮短 30%"),
  bear: ability("bear", "大力土木", "💪", 0.5, ["civil", "heavy"], "土木與重型工程時間縮短 50%"),
  panda: ability("panda", "悠閒園藝", "🎋", 0.6, ["decoration", "orchard"], "景觀與果園工程時間縮短 40%"),
  koala: ability("koala", "樹梢專家", "🌿", 0.6, ["orchard", "farming"], "果園與農業設施時間縮短 40%"),
  tiger: ability("tiger", "重機虎將", "🏗️", 0.6, ["factory", "heavy"], "工廠與重型工程時間縮短 40%"),
  lion: ability("lion", "工地主任", "📋", 0.75, ["utility", "civil", "commerce"], "公共、土木與商業設施時間縮短 25%"),
  frog: ability("frog", "親水園丁", "💧", 0.55, ["waterfront", "farming"], "水岸與農業設施時間縮短 45%"),
  pig: ability("pig", "美食鼻子", "🍽️", 0.65, ["food", "farming"], "食品與農業設施時間縮短 35%"),
  cow: ability("cow", "牧場照護", "🔔", 0.55, ["animal", "food"], "畜產與食品設施時間縮短 45%"),
  monkey: ability("monkey", "熱帶採收", "🫘", 0.55, ["orchard", "coffee", "cocoa"], "果園、咖啡與可可設施時間縮短 45%"),
  chicken: ability("chicken", "禽舍幫手", "🥚", 0.65, ["animal", "farming"], "畜產與農業設施時間縮短 35%"),
  penguin: ability("penguin", "冷藏能手", "🧊", 0.65, ["factory", "food"], "工廠與食品設施時間縮短 35%"),
  whale: ability("whale", "海工巨匠", "🌊", 0.5, ["waterfront", "heavy"], "水岸與重型工程時間縮短 50%"),
  dolphin: ability("dolphin", "港灣快手", "⚓", 0.55, ["waterfront", "commerce"], "水岸與商業設施時間縮短 45%"),
  owl: ability("owl", "工程規劃", "📐", 0.65, ["factory", "utility", "craft"], "工廠、公共與工藝設施時間縮短 35%"),
  duck: ability("duck", "水田達人", "🪷", 0.6, ["waterfront", "animal"], "水岸與畜產設施時間縮短 40%"),
  horse: ability("horse", "搬運健將", "🛷", 0.6, ["civil", "farming", "heavy"], "土木、農業與重型工程時間縮短 40%"),
  deer: ability("deer", "森林美學", "🍃", 0.6, ["orchard", "decoration"], "果園與景觀設施時間縮短 40%"),
  sheep: ability("sheep", "織品專家", "🧶", 0.55, ["animal", "craft"], "畜產與工藝設施時間縮短 45%"),
  otter: ability("otter", "水岸工匠", "🪵", 0.6, ["waterfront", "craft"], "水岸與手作工程時間縮短 40%")
});

const DEFAULT_ABILITY = Object.freeze({
  id: "friend",
  name: "熱心幫手",
  icon: "🤝",
  timeMultiplier: 1,
  tags: Object.freeze([]),
  description: "目前沒有對應的專長加速"
});

export function companionAbility(workerId) {
  return COMPANION_ABILITIES[workerId] || DEFAULT_ABILITY;
}

export function companionAbilityApplies(workerId, workTags = []) {
  const abilityDefinition = companionAbility(workerId);
  const targetTags = new Set(Array.isArray(workTags) ? workTags : []);
  return abilityDefinition.tags.some((tag) => targetTags.has(tag));
}

export function companionTimeMultiplier(workerId, workTags = []) {
  return companionAbilityApplies(workerId, workTags) ? companionAbility(workerId).timeMultiplier : 1;
}

export function companionReductionPercent(workerId, workTags = []) {
  return Math.round((1 - companionTimeMultiplier(workerId, workTags)) * 100);
}

const workerCountRate = (count) => count >= 3 ? 2 : count === 2 ? 1.5 : 1;

export function constructionTeamRate(workerIds = [], workTags = []) {
  const ids = workerIds.filter(Boolean);
  if (!ids.length) return 1;
  const specialistRate = ids.reduce((total, id) => total + (1 / companionTimeMultiplier(id, workTags)), 0) / ids.length;
  return workerCountRate(ids.length) * specialistRate;
}

export function adjustedConstructionDuration(baseDurationSeconds, workerIds = [], workTags = []) {
  const seconds = Math.max(0, Number(baseDurationSeconds) || 0);
  return seconds / constructionTeamRate(workerIds, workTags);
}
