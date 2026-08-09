import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { BUILDING_CATALOG, ISLAND_TEST_MODE, ITEM_CATALOG, RECIPE_CATALOG } from "../src/island/catalog.js";
import { COMPANION_ABILITIES, companionAbility, constructionTeamRate } from "../src/island/companions.js";
import { FRIEND_ROSTER } from "../src/game/friends.js";
import { axialKey, hexRange } from "../src/island/hex.js";
import {
  availableConstructionWorkerIds,
  collectFacility,
  createIslandState,
  finishIslandWork,
  helperQuote,
  hireConstructionHelper,
  initialWorkerHireCost,
  isReclaimable,
  marketSale,
  normalizeIslandState,
  selectSourceRecipe,
  startBuilding,
  startProcessing,
  startReclamation
} from "../src/island/model.js";
import { renderIslandScreen } from "../src/island/renderer.js";

const T0 = Date.parse("2026-08-09T00:00:00.000Z");
const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const islandStyles = readFileSync(new URL("../src/island/island.css", import.meta.url), "utf8");
const pointerDownSource = appSource.slice(appSource.indexOf('viewport.addEventListener("pointerdown"'), appSource.indexOf('viewport.addEventListener("pointermove"'));
const pointerMoveSource = appSource.slice(appSource.indexOf('viewport.addEventListener("pointermove"'), appSource.indexOf("const finishDrag"));
let now = T0;
let state = createIslandState({ playerId: "test-player", playerName: "測試員", playerAvatar: "cat", now });

assert.equal(typeof ISLAND_TEST_MODE, "boolean", "小島測試模式必須由單一布林設定控制，PUSH 前可直接關閉");
assert.equal(hexRange(4).length, 61, "半徑 4 的六角地圖應有 61 格");
assert.equal(Object.keys(state.tiles).length, 7, "新玩家應從 7 格小島開始");
assert.equal(Object.keys(state.buildings).length, 1, "新玩家只需要兼作倉庫的島主小屋");
assert.equal(state.buildings["starter-home"].buildingId, "islandHome", "島主小屋應是唯一初始建築");
assert(!Object.values(state.buildings).some((building) => building.buildingId === "warehouse"), "不可再額外占一格放倉庫");
assert(isReclaimable(state, 2, 0), "與初始土地相鄰的第二圈海域應可填海");
assert.equal(Object.keys(COMPANION_ABILITIES).length, 25, "25 位小伙伴都應有自己的施工專長");
assert(FRIEND_ROSTER.every((friend) => COMPANION_ABILITIES[friend.id]), "伙伴名冊中的每一位都必須能找到能力定義");
assert.equal(new Set(Object.values(COMPANION_ABILITIES).map((entry) => entry.name)).size, 25, "每位伙伴的能力名稱應清楚區分");
assert.equal(companionAbility("bear").timeMultiplier, 0.5, "熊的大力土木應讓適用工程工期縮短 50%");
assert(constructionTeamRate(["bear"], BUILDING_CATALOG.workshed.workTags) === 2, "熊進行土木工程時施工速度應為兩倍");

const catReclaimDuration = startReclamation(createIslandState({ now }), { q: 2, r: 0, workerId: "cat", now }).job.readyAt - now;
const bearReclaimDuration = startReclamation(createIslandState({ now }), { q: 2, r: 0, workerId: "bear", playerAvatar: "cat", now }).job.readyAt - now;
assert.equal(bearReclaimDuration, catReclaimDuration / 2, "熊單獨填海時實際 readyAt 應縮短 50%");

const reclaim = startReclamation(state, { q: 2, r: 0, workerId: "cat", playerAvatar: "cat", now });
assert(reclaim.ok && reclaim.costCoins === 25, "自己的空閒伙伴應可開始第一次填海且不收雇用費");
state = reclaim.state;
const blockedCat = startBuilding(state, { buildingId: "garden", q: -1, r: 0, workerId: "cat", playerAvatar: "cat", now });
assert(!blockedCat.ok && /已經在忙/.test(blockedCat.error), "同一伙伴同時只能做一件施工工作");
assert(!availableConstructionWorkerIds(state, ["cat", "dog"]).includes("cat"), "忙碌伙伴不可出現在新工程可指派名單");

const dogHireCost = initialWorkerHireCost("dog", "cat", BUILDING_CATALOG.garden.costCoins);
const gardenStart = startBuilding(state, { buildingId: "garden", q: -1, r: 0, workerId: "dog", playerAvatar: "cat", now });
assert(gardenStart.ok && gardenStart.workerHireCost === dogHireCost && dogHireCost >= 8, "另開工程應可付費聘用其他空閒伙伴");
state = gardenStart.state;
assert.equal(helperQuote(reclaim.job), 8, "第一次增加施工伙伴應採最低 8 金幣");
const helped = hireConstructionHelper(state, { jobId: reclaim.job.id, helperId: "mouse", now: now + 60_000 });
assert(helped.ok && helped.job.readyAt < reclaim.job.readyAt, "增加第三位以外的空閒伙伴後應依剩餘工作量提前完工");
state = helped.state;
const busyDogHelper = hireConstructionHelper(state, { jobId: reclaim.job.id, helperId: "dog", now: now + 60_000 });
assert(!busyDogHelper.ok && /其他工程/.test(busyDogHelper.error), "正在別的工程工作的伙伴不能再加入加速");

function finish(kind, id) {
  now += 1_000;
  const result = finishIslandWork(state, { kind, id, now });
  assert(result.ok, `${kind} 工作應可在測試模式呼叫馬上完成`);
  state = result.state;
}

finish("construction", reclaim.job.id);
assert(state.tiles[axialKey(2, 0)] && state.reclaimedCount === 1, "馬上完成填海後應立即得到土地");
finish("construction", gardenStart.job.id);

function buildNow(buildingId, q, r, workerId = "cat") {
  const started = startBuilding(state, { buildingId, q, r, workerId, playerAvatar: "cat", now });
  assert(started.ok, `${BUILDING_CATALOG[buildingId].name} 應可在空地施工`);
  state = started.state;
  finish("construction", started.job.id);
  return Object.values(state.buildings).find((entry) => entry.buildingId === buildingId);
}

const garden = Object.values(state.buildings).find((entry) => entry.buildingId === "garden");
const market = buildNow("market", 1, 0);
finish("source", garden.id);
let harvest = collectFacility(state, { buildingInstanceId: garden.id, now });
assert(harvest.ok && harvest.state.inventory.vegetable === 2, "菜園成熟後應把一批蔬菜收入小屋倉庫");
state = harvest.state;
const sale = marketSale(state, { itemId: "vegetable", quantity: 2, now });
assert(sale.ok && sale.coinsEarned === ITEM_CATALOG.vegetable.marketCoins * 2, "市場應按數量立即換成金幣");
state = sale.state;

let sourceSwitch = selectSourceRecipe(state, { buildingInstanceId: garden.id, recipeId: "carrotHarvest", now });
assert(sourceSwitch.ok && sourceSwitch.state.facilities[garden.id].recipeId === "carrotHarvest", "菜園應可改種不同作物並重開一批生產時間");
state = sourceSwitch.state;
finish("source", garden.id);
harvest = collectFacility(state, { buildingInstanceId: garden.id, now });
assert(harvest.ok && harvest.state.inventory.carrot === 3, "改種胡蘿蔔後應收到對應產物");
state = harvest.state;

const cornField = buildNow("cornField", 1, -1);
const ranch = buildNow("ranch", 0, -1);
const factory = buildNow("foodFactory", -1, 1);

function collectNow(building) {
  const result = collectFacility(state, { buildingInstanceId: building.id, now });
  assert(result.ok, `${BUILDING_CATALOG[building.buildingId].name} 完成後應可領取`);
  state = result.state;
}

finish("source", cornField.id);
collectNow(cornField);
let process = startProcessing(state, { buildingInstanceId: ranch.id, recipeId: "milkBatch", now });
assert(process.ok, "牧場應消耗 2 玉米開始一批牛奶");
state = process.state;
finish("processing", process.job.id);
collectNow(ranch);

finish("source", cornField.id);
collectNow(cornField);
process = startProcessing(state, { buildingInstanceId: ranch.id, recipeId: "milkBatch", now });
assert(process.ok, "牧場應允許繼續建立後續加工批次");
state = process.state;
finish("processing", process.job.id);
collectNow(ranch);
assert.equal(state.inventory.milk, 2, "兩批牧場工作應累積 2 牛奶在小屋倉庫");

process = startProcessing(state, { buildingInstanceId: factory.id, recipeId: "dairyBatch", now });
assert(process.ok, "食品工廠應消耗 2 牛奶開始乳製品加工");
state = process.state;
finish("processing", process.job.id);
collectNow(factory);
assert.equal(state.inventory.dairyBox, 1, "三層產業鏈最後應產出乳製品箱");
assert(BUILDING_CATALOG.ranch.description.includes("不殺生") && BUILDING_CATALOG.ranch.recipeIds.includes("eggBatch") && BUILDING_CATALOG.ranch.recipeIds.includes("woolBatch"), "牧場應採牛奶、雞蛋、羊毛的非殺生設計");
assert(BUILDING_CATALOG.orchard.recipeIds.includes("coffeeHarvest") && BUILDING_CATALOG.orchard.recipeIds.includes("cocoaHarvest"), "果園應支援咖啡與可可作物");
assert(RECIPE_CATALOG.brewCoffee.inputs.roastedCoffee === 1 && RECIPE_CATALOG.chocolateBatch.outputs.chocolate === 1, "咖啡與可可加工鏈應完整接到高價產品");
Object.values(RECIPE_CATALOG).forEach((recipe) => {
  assert(BUILDING_CATALOG[recipe.facilityId], `配方 ${recipe.id} 的設施必須存在`);
  Object.keys({ ...recipe.inputs, ...recipe.outputs }).forEach((itemId) => assert(ITEM_CATALOG[itemId], `配方 ${recipe.id} 的品項 ${itemId} 必須存在`));
});
for (const recipe of Object.values(RECIPE_CATALOG)) {
  let recipeState = createIslandState({ playerAvatar: "cat", now });
  recipeState.buildings.fixture = { id: "fixture", buildingId: recipe.facilityId, q: 0, r: 1, orientation: 0, completedAt: now };
  recipeState.facilities.fixture = { buildingInstanceId: "fixture", recipeId: "", state: "idle", startedAt: 0, readyAt: 0, readyOutput: {}, readyOutputs: {}, updatedAt: now };
  if (recipe.kind === "source") {
    const selected = selectSourceRecipe(recipeState, { buildingInstanceId: "fixture", recipeId: recipe.id, now });
    assert(selected.ok, `來源配方 ${recipe.id} 應可在對應設施啟動`);
    const completed = finishIslandWork(selected.state, { kind: "source", id: "fixture", now: now + 1 });
    const collected = collectFacility(completed.state, { buildingInstanceId: "fixture", now: now + 1 });
    assert(collected.ok, `來源配方 ${recipe.id} 完成後應可收成`);
    Object.entries(recipe.outputs).forEach(([itemId, count]) => assert.equal(collected.state.inventory[itemId], count, `來源配方 ${recipe.id} 應產出正確數量`));
  } else {
    Object.keys(recipeState.inventory).forEach((itemId) => { recipeState.inventory[itemId] = 20; });
    Object.keys(recipe.outputs).forEach((itemId) => { recipeState.inventory[itemId] = 0; });
    const started = startProcessing(recipeState, { buildingInstanceId: "fixture", recipeId: recipe.id, now });
    assert(started.ok, `加工配方 ${recipe.id} 應可在原料充足時啟動`);
    const completed = finishIslandWork(started.state, { kind: "processing", id: started.job.id, now: now + 1 });
    const collected = collectFacility(completed.state, { buildingInstanceId: "fixture", now: now + 1 });
    assert(collected.ok, `加工配方 ${recipe.id} 完成後應可領取`);
    Object.entries(recipe.outputs).forEach(([itemId, count]) => assert.equal(collected.state.inventory[itemId], count, `加工配方 ${recipe.id} 應產出正確數量`));
  }
}

const noInputState = structuredClone(state);
noInputState.inventory.milk = 0;
const unlimitedProcess = startProcessing(noInputState, { buildingInstanceId: factory.id, recipeId: "dairyBatch", now, ignoreInputs: true });
assert(unlimitedProcess.ok && unlimitedProcess.state.inventory.milk === 0, "測試模式應能不受原料數量限制且不扣庫存");

const normalized = normalizeIslandState(JSON.parse(JSON.stringify(state)), { playerId: "test-player", now });
assert.equal(normalized.inventory.dairyBox, 1, "小島資料序列化後應可完整還原");
const previewJob = startBuilding(normalized, { buildingId: "flowerGarden", q: 0, r: 1, workerId: "cat", playerAvatar: "cat", now });
assert(previewJob.ok, "Renderer 測試前應有一項進行中工程");
const markup = renderIslandScreen({
  state: previewJob.state,
  coins: 0,
  selectedKey: "0,0",
  helpers: [{ id: "dog", name: "狗" }],
  workers: [{ id: "dog", name: "狗" }],
  selectedWorkerId: "dog",
  playerAvatar: "cat",
  testMode: true,
  now,
  version: "test"
});
const catalogMarkup = renderIslandScreen({
  state: createIslandState({ playerAvatar: "cat", now }),
  coins: 999,
  selectedKey: "0,1",
  helpers: [],
  workers: [{ id: "cat", name: "貓" }, { id: "bear", name: "熊" }],
  selectedWorkerId: "cat",
  playerAvatar: "cat",
  testMode: true,
  now,
  version: "test"
});
const hexButtons = markup.match(/<button class="island-hex[\s\S]*?<\/button>/g) || [];
assert(hexButtons.length === 61 && hexButtons.every((button) => !button.includes("data-island-ready-at")), "施工倒數不可顯示在地圖六角格上");
assert(/目前進行中的工作/.test(markup) && /data-island-ready-at/.test(markup), "底部欄應改為顯示目前進行中的工作與時間");
assert(/小屋倉庫・容量無上限/.test(markup) && !/class="island-inventory"/.test(markup), "庫存只應在點選島主小屋後顯示");
assert(/data-island-finish-kind/.test(markup) && /測試資源 ∞/.test(markup), "測試模式應顯示無限資源與馬上完成按鈕");
assert(/data-island-zoom="out"/.test(markup) && /data-island-map-viewport/.test(markup), "縮放按鈕與滾輪事件接點應位於地圖區域");
assert(/island-build-category/.test(catalogMarkup) && /農業與採集/.test(catalogMarkup) && /加工與畜產/.test(catalogMarkup), "建築目錄應依用途顯示為巢狀分類");
assert(/靈巧佈置|大力土木/.test(catalogMarkup), "施工伙伴選擇器應顯示伙伴能力");
assert(/pointerdown/.test(appSource) && /pointermove/.test(appSource) && /islandDragged/.test(appSource), "地圖應支援滑鼠與手機 Pointer Events 拖曳並防止拖後誤觸");
assert(!/setPointerCapture/.test(pointerDownSource) && /setPointerCapture/.test(pointerMoveSource), "一般點擊不可在 pointerdown 時被地圖接管，只有超過拖曳門檻後才能 capture");
assert(/touch-action:\s*none/.test(islandStyles) && /cursor:\s*grab/.test(islandStyles), "地圖拖曳應關閉瀏覽器手勢衝突並顯示拖曳游標");
assert.equal(RECIPE_CATALOG.dairyBatch.outputs.dairyBox, 1, "配方目錄應保留可擴充的資料驅動輸出");

console.log("Island foundation checks passed.");
