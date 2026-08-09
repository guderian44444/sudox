export const ISLAND_SCHEMA_VERSION = 1;
export const ISLAND_RADIUS = 4;
export const STARTER_LAND_RADIUS = 1;

const minutes = (value) => value * 60;
const hours = (value) => minutes(value * 60);

export const ITEM_CATALOG = Object.freeze({
  vegetable: Object.freeze({ id: "vegetable", name: "蔬菜", icon: "🥬", marketCoins: 6, assetKey: "items/vegetable" }),
  corn: Object.freeze({ id: "corn", name: "玉米", icon: "🌽", marketCoins: 4, assetKey: "items/corn" }),
  milk: Object.freeze({ id: "milk", name: "牛奶", icon: "🥛", marketCoins: 14, assetKey: "items/milk" }),
  dairyBox: Object.freeze({ id: "dairyBox", name: "乳製品箱", icon: "🧀", marketCoins: 50, assetKey: "items/dairy-box" })
});

export const RECIPE_CATALOG = Object.freeze({
  vegetableHarvest: Object.freeze({
    id: "vegetableHarvest",
    name: "種植蔬菜",
    kind: "source",
    facilityId: "garden",
    inputs: Object.freeze({}),
    outputs: Object.freeze({ vegetable: 2 }),
    durationSeconds: minutes(45)
  }),
  cornHarvest: Object.freeze({
    id: "cornHarvest",
    name: "種植玉米",
    kind: "source",
    facilityId: "cornField",
    inputs: Object.freeze({}),
    outputs: Object.freeze({ corn: 2 }),
    durationSeconds: hours(1)
  }),
  milkBatch: Object.freeze({
    id: "milkBatch",
    name: "餵牛產奶",
    kind: "processor",
    facilityId: "ranch",
    inputs: Object.freeze({ corn: 2 }),
    outputs: Object.freeze({ milk: 1 }),
    durationSeconds: hours(2)
  }),
  dairyBatch: Object.freeze({
    id: "dairyBatch",
    name: "加工乳製品",
    kind: "processor",
    facilityId: "foodFactory",
    inputs: Object.freeze({ milk: 2 }),
    outputs: Object.freeze({ dairyBox: 1 }),
    durationSeconds: hours(3)
  })
});

export const BUILDING_CATALOG = Object.freeze({
  islandHome: Object.freeze({
    id: "islandHome", name: "島主小屋", icon: "🏠", category: "starter", buildable: false,
    footprint: Object.freeze([{ q: 0, r: 0 }]), costCoins: 0, durationSeconds: 0,
    description: "小島的中心，也是伙伴休息的地方。", assetKey: "buildings/island-home"
  }),
  warehouse: Object.freeze({
    id: "warehouse", name: "島嶼倉庫", icon: "📦", category: "starter", buildable: false,
    footprint: Object.freeze([{ q: 0, r: 0 }]), costCoins: 0, durationSeconds: 0,
    description: "無上限保存所有原料、半成品與成品。", assetKey: "buildings/warehouse"
  }),
  garden: Object.freeze({
    id: "garden", name: "菜園", icon: "🥬", category: "source", buildable: true,
    footprint: Object.freeze([{ q: 0, r: 0 }]), costCoins: 20, durationSeconds: minutes(20),
    defaultRecipeId: "vegetableHarvest", description: "成熟後點擊收成，蔬菜會進入倉庫。", assetKey: "buildings/garden"
  }),
  market: Object.freeze({
    id: "market", name: "小島市場", icon: "🏪", category: "market", buildable: true,
    footprint: Object.freeze([{ q: 0, r: 0 }]), costCoins: 60, durationSeconds: hours(1),
    description: "把倉庫中的產品直接換成金幣。", assetKey: "buildings/market"
  }),
  cornField: Object.freeze({
    id: "cornField", name: "玉米田", icon: "🌽", category: "source", buildable: true,
    footprint: Object.freeze([{ q: 0, r: 0 }]), costCoins: 50, durationSeconds: hours(1),
    defaultRecipeId: "cornHarvest", description: "成熟後收成玉米，可直售或送去牧場。", assetKey: "buildings/corn-field"
  }),
  ranch: Object.freeze({
    id: "ranch", name: "乳牛牧場", icon: "🐄", category: "processor", buildable: true,
    footprint: Object.freeze([{ q: 0, r: 0 }]), costCoins: 180, durationSeconds: hours(4),
    recipeIds: Object.freeze(["milkBatch"]), description: "投入玉米後開始產奶，多批可以平行進行。", assetKey: "buildings/ranch"
  }),
  foodFactory: Object.freeze({
    id: "foodFactory", name: "食品工廠", icon: "🏭", category: "processor", buildable: true,
    footprint: Object.freeze([{ q: 0, r: 0 }]), costCoins: 320, durationSeconds: hours(8),
    recipeIds: Object.freeze(["dairyBatch"]), description: "把牛奶加工成價值更高的乳製品箱。", assetKey: "buildings/food-factory"
  }),
  flowerGarden: Object.freeze({
    id: "flowerGarden", name: "花園", icon: "🌷", category: "decoration", buildable: true,
    footprint: Object.freeze([{ q: 0, r: 0 }]), costCoins: 30, durationSeconds: minutes(30),
    description: "純裝飾設施，讓小島更有生氣。", assetKey: "buildings/flower-garden"
  }),
  workshed: Object.freeze({
    id: "workshed", name: "工務小屋", icon: "🛠️", category: "utility", buildable: true,
    footprint: Object.freeze([{ q: 0, r: 0 }]), costCoins: 100, durationSeconds: hours(2),
    description: "為後續增加施工欄位與工程功能預留。", assetKey: "buildings/workshed"
  }),
  playground: Object.freeze({
    id: "playground", name: "遊樂場", icon: "🎠", category: "decoration", buildable: true,
    footprint: Object.freeze([{ q: 0, r: 0 }]), costCoins: 160, durationSeconds: hours(4),
    description: "伙伴完工後會來這裡玩。", assetKey: "buildings/playground"
  }),
  dock: Object.freeze({
    id: "dock", name: "碼頭", icon: "⚓", category: "logistics", buildable: false, comingSoon: true,
    footprint: Object.freeze([{ q: 0, r: 0 }, { q: 1, r: 0 }]), costCoins: 350, durationSeconds: hours(8),
    description: "合作物流接點；後續版本開放跨島運輸。", assetKey: "buildings/dock"
  }),
  airport: Object.freeze({
    id: "airport", name: "機場", icon: "✈️", category: "logistics", buildable: false, comingSoon: true,
    footprint: Object.freeze([{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }]), costCoins: 900, durationSeconds: hours(24),
    description: "快速物流接點；資料模型已預留。", assetKey: "buildings/airport"
  })
});

export const BUILDABLE_BUILDINGS = Object.freeze(Object.values(BUILDING_CATALOG).filter((building) => building.buildable));

export function reclamationQuote(reclaimedCount = 0) {
  const count = Math.max(0, Math.floor(Number(reclaimedCount) || 0));
  if (count < 6) return { costCoins: 25, durationSeconds: minutes(30) };
  if (count < 12) return { costCoins: 50, durationSeconds: hours(1) };
  const outerSteps = Math.floor((count - 12) / 6);
  return { costCoins: 75 + outerSteps * 10, durationSeconds: hours(2) };
}

export function recipeInputsLabel(recipe) {
  return Object.entries(recipe?.inputs || {}).map(([itemId, count]) => `${ITEM_CATALOG[itemId]?.icon || "📦"}${count}`).join(" ") || "無需原料";
}

export function recipeOutputsLabel(recipe) {
  return Object.entries(recipe?.outputs || {}).map(([itemId, count]) => `${ITEM_CATALOG[itemId]?.icon || "📦"}${count}`).join(" ");
}
