import { strict as assert } from "node:assert";
import { BUILDING_CATALOG, ITEM_CATALOG, RECIPE_CATALOG } from "../src/island/catalog.js";
import { axialKey, hexRange } from "../src/island/hex.js";
import {
  collectFacility,
  createIslandState,
  helperQuote,
  hireConstructionHelper,
  isReclaimable,
  marketSale,
  normalizeIslandState,
  settleIsland,
  startBuilding,
  startProcessing,
  startReclamation
} from "../src/island/model.js";
import { renderIslandScreen } from "../src/island/renderer.js";

const T0 = Date.parse("2026-08-09T00:00:00.000Z");
let state = createIslandState({ playerId: "test-player", playerName: "測試員", playerAvatar: "cat", now: T0 });

assert.equal(hexRange(4).length, 61, "半徑 4 的六角地圖應有 61 格");
assert.equal(Object.keys(state.tiles).length, 7, "新玩家應從 7 格小島開始");
assert.equal(Object.keys(state.buildings).length, 2, "新玩家應有島主小屋與無上限倉庫");
assert(isReclaimable(state, 2, 0), "與初始土地相鄰的第二圈海域應可填海");

const reclaim = startReclamation(state, { q: 2, r: 0, workerId: "cat", now: T0 });
assert(reclaim.ok && reclaim.costCoins === 25, "第一次填海應建立施工工作並收取 25 金幣");
const originalReadyAt = reclaim.job.readyAt;
assert.equal(helperQuote(reclaim.job), 8, "第一次雇用施工伙伴應採最低 8 金幣");
const helped = hireConstructionHelper(reclaim.state, { jobId: reclaim.job.id, helperId: "dog", now: T0 + 5 * 60 * 1000 });
assert(helped.ok && helped.job.readyAt < originalReadyAt, "增加伙伴後應依剩餘工作量提前完工");
state = settleIsland(helped.state, originalReadyAt).state;
assert(state.tiles[axialKey(2, 0)] && state.reclaimedCount === 1, "到達 readyAt 後才把海域結算成土地");

function build(buildingId, q, r, now = T0) {
  const started = startBuilding(state, { buildingId, q, r, workerId: "cat", now });
  assert(started.ok, `${BUILDING_CATALOG[buildingId].name} 應可在空地施工`);
  state = started.state;
  return started.job.readyAt;
}

const gardenReady = build("garden", -1, 0);
const marketReady = build("market", 0, 1);
state = settleIsland(state, Math.max(gardenReady, marketReady)).state;
const garden = Object.values(state.buildings).find((entry) => entry.buildingId === "garden");
const market = Object.values(state.buildings).find((entry) => entry.buildingId === "market");
assert(garden && market, "施工結算後應建立菜園與市場實體");

const vegetableReadyAt = state.facilities[garden.id].readyAt;
state = settleIsland(state, vegetableReadyAt).state;
const harvest = collectFacility(state, { buildingInstanceId: garden.id, now: vegetableReadyAt });
assert(harvest.ok && harvest.state.inventory.vegetable === 2, "成熟菜園點擊後應把一批蔬菜收入無上限倉庫");
state = harvest.state;
const sale = marketSale(state, { itemId: "vegetable", quantity: 2, now: vegetableReadyAt });
assert(sale.ok && sale.coinsEarned === ITEM_CATALOG.vegetable.marketCoins * 2, "市場應按數量立即換成金幣");
state = sale.state;

const cornReady = build("cornField", 1, -1, T0);
const ranchReady = build("ranch", 0, -1, T0);
const factoryReady = build("foodFactory", -1, 1, T0);
state = settleIsland(state, Math.max(cornReady, ranchReady, factoryReady)).state;
const cornField = Object.values(state.buildings).find((entry) => entry.buildingId === "cornField");
const ranch = Object.values(state.buildings).find((entry) => entry.buildingId === "ranch");
const factory = Object.values(state.buildings).find((entry) => entry.buildingId === "foodFactory");

function collectAt(building, now) {
  state = settleIsland(state, now).state;
  const result = collectFacility(state, { buildingInstanceId: building.id, now });
  assert(result.ok, `${BUILDING_CATALOG[building.buildingId].name} 在完成後應可領取`);
  state = result.state;
}

collectAt(cornField, Math.max(factoryReady, state.facilities[cornField.id].readyAt));
let process = startProcessing(state, { buildingInstanceId: ranch.id, recipeId: "milkBatch", now: factoryReady });
assert(process.ok, "牧場應消耗 2 玉米開始一批牛奶");
state = process.state;
collectAt(ranch, process.job.readyAt);

collectAt(cornField, Math.max(process.job.readyAt, state.facilities[cornField.id].readyAt));
process = startProcessing(state, { buildingInstanceId: ranch.id, recipeId: "milkBatch", now: state.lastSettledAt });
assert(process.ok, "牧場應允許繼續建立後續加工批次");
state = process.state;
collectAt(ranch, process.job.readyAt);
assert.equal(state.inventory.milk, 2, "兩批牧場工作應累積 2 牛奶在倉庫");

process = startProcessing(state, { buildingInstanceId: factory.id, recipeId: "dairyBatch", now: state.lastSettledAt });
assert(process.ok, "食品工廠應消耗 2 牛奶開始乳製品加工");
state = process.state;
collectAt(factory, process.job.readyAt);
assert.equal(state.inventory.dairyBox, 1, "三層產業鏈最後應產出乳製品箱");

const normalized = normalizeIslandState(JSON.parse(JSON.stringify(state)), { playerId: "test-player", now: T0 });
assert.equal(normalized.inventory.dairyBox, 1, "小島資料序列化後應可完整還原");
const markup = renderIslandScreen({ state: normalized, coins: 100, selectedKey: "2,0", helpers: [{ id: "dog", name: "狗" }], now: T0, version: "test" });
assert(/data-island-cell="2,0"/.test(markup) && /無上限倉庫/.test(markup) && /小島架構版 test/.test(markup), "畫面應提供六角格操作、倉庫與版本資訊");
assert.equal(RECIPE_CATALOG.dairyBatch.outputs.dairyBox, 1, "配方目錄應保留可擴充的資料驅動輸出");

console.log("Island foundation checks passed.");
