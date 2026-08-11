import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { BUILDING_CATALOG, HOME_LEVELS, ISLAND_TEST_MODE, ITEM_CATALOG, RECIPE_CATALOG } from "../src/island/catalog.js";
import { COMPANION_ABILITIES, companionAbility, constructionTeamRate } from "../src/island/companions.js";
import { FRIEND_ROSTER } from "../src/game/friends.js";
import { axialKey, hexRange } from "../src/island/hex.js";
import { DEMO_ISLAND_PARTNERS, availableTransportMethods, dispatchDemoShipment, mergeCloudLogistics, partnerLogisticsOffers, shipmentQuote } from "../src/island/logistics.js";
import {
  availableConstructionWorkerIds,
  collectFacility,
  createIslandState,
  finishIslandWork,
  helperQuote,
  hireConstructionHelper,
  initialWorkerHireCost,
  islandInventoryCapacity,
  islandInventoryUsed,
  isReclaimable,
  marketSale,
  normalizeIslandState,
  selectSourceRecipe,
  settleIsland,
  startBuilding,
  startDemolition,
  startHomeUpgrade,
  startProcessing,
  startReclamation
} from "../src/island/model.js";
import { renderIslandScreen } from "../src/island/renderer.js";
import { mergeProgressHighWater } from "../src/state/store.js";

const T0 = Date.parse("2026-08-09T00:00:00.000Z");
const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const rendererSource = readFileSync(new URL("../src/island/renderer.js", import.meta.url), "utf8");
const islandStyles = readFileSync(new URL("../src/island/island.css", import.meta.url), "utf8");
const logisticsSql = readFileSync(new URL("../supabase/island-logistics-migration.sql", import.meta.url), "utf8");
const cloudConcurrencySql = readFileSync(new URL("../supabase/cloud-save-concurrency-migration.sql", import.meta.url), "utf8");
const pointerDownSource = appSource.slice(appSource.indexOf('viewport.addEventListener("pointerdown"'), appSource.indexOf('viewport.addEventListener("pointermove"'));
const pointerMoveSource = appSource.slice(appSource.indexOf('viewport.addEventListener("pointermove"'), appSource.indexOf("const finishDrag"));
let now = T0;
let state = createIslandState({ playerId: "test-player", playerName: "測試員", playerAvatar: "cat", now });

assert.equal(typeof ISLAND_TEST_MODE, "boolean", "小島測試模式必須由單一布林設定控制，PUSH 前可直接關閉");
assert.equal(hexRange(8).length, 217, "擴大後半徑 8 的六角地圖應有 217 格");
assert.equal(state.radius, 8, "新舊玩家都應使用擴大一倍的半徑 8 地圖");
assert.equal(Object.keys(state.tiles).length, 7, "新玩家應從 7 格小島開始");
assert.equal(Object.keys(state.buildings).length, 1, "新玩家只需要兼作倉庫的島主小屋");
assert.equal(state.buildings["starter-home"].buildingId, "islandHome", "島主小屋應是唯一初始建築");
assert.equal(BUILDING_CATALOG.workshed, undefined, "沒有實際功能的工務小屋應從建築目錄移除");
assert(!Object.values(state.buildings).some((building) => building.buildingId === "warehouse"), "不可再額外占一格放倉庫");
assert(isReclaimable(state, 2, 0), "與初始土地相鄰的第二圈海域應可填海");
assert.equal(Object.keys(COMPANION_ABILITIES).length, 25, "25 位小伙伴都應有自己的施工專長");
assert(FRIEND_ROSTER.every((friend) => COMPANION_ABILITIES[friend.id]), "伙伴名冊中的每一位都必須能找到能力定義");
assert.equal(new Set(Object.values(COMPANION_ABILITIES).map((entry) => entry.name)).size, 25, "每位伙伴的能力名稱應清楚區分");
assert.equal(companionAbility("bear").timeMultiplier, 0.5, "熊的大力土木應讓適用工程工期縮短 50%");
assert(constructionTeamRate(["bear"], BUILDING_CATALOG.lighthouse.workTags) === 2, "熊進行土木工程時施工速度應為兩倍");

const dockStart = startBuilding(createIslandState({ now }), { buildingId: "dock", q: 1, r: 0, workerId: "cat", now });
assert(dockStart.ok && dockStart.job.orientation === 0, "合作碼頭應自動朝向相鄰海面");
const rotatedDockStart = startBuilding(createIslandState({ now }), { buildingId: "dock", q: -1, r: 1, workerId: "cat", now });
assert(rotatedDockStart.ok && rotatedDockStart.job.orientation !== 0, "碼頭未指定方向時應依其他五個方向尋找相鄰海面");
assert(!isReclaimable(dockStart.state, 2, 0), "碼頭占用的海面格不可同時填海");
const airportState = createIslandState({ now });
const airportStart = startBuilding(airportState, { buildingId: "airport", q: 1, r: -1, orientation: 0, workerId: "cat", now });
assert(airportStart.ok && BUILDING_CATALOG.airport.footprint.length === 1, "小島機場應簡化為單一陸地格即可施工");

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
const duplicateCollect = collectFacility(state, { buildingInstanceId: factory.id, now });
assert(!duplicateCollect.ok, "同一批產品在同一裝置上第二次收成應被拒絕");
assert.equal(state.inventory.dairyBox, 1, "三層產業鏈最後應產出乳製品箱");
assert(state.statistics.produced.vegetable >= 2 && state.statistics.produced.milk >= 2 && state.statistics.sold.vegetable === 2, "生產完成與市場成交應累積到統計事件，不可只由目前庫存倒推");
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
    Object.entries(recipe.inputs).forEach(([itemId, count]) => { recipeState.inventory[itemId] = count; });
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
const blockedNoInputProcess = startProcessing(noInputState, { buildingInstanceId: factory.id, recipeId: "dairyBatch", now });
assert(!blockedNoInputProcess.ok && /原料不足/.test(blockedNoInputProcess.error), "即使仍在測試模式，單有食品工房也不能無原料生產");

assert(BUILDING_CATALOG.garden.recipeIds.includes("pumpkinHarvest") && BUILDING_CATALOG.garden.recipeIds.includes("potatoHarvest"), "百變菜園應新增南瓜與馬鈴薯");
assert(BUILDING_CATALOG.grainField && BUILDING_CATALOG.paddy && BUILDING_CATALOG.teaGarden && BUILDING_CATALOG.vineyard && BUILDING_CATALOG.sugarcaneField, "農業目錄應新增麥田、水稻田、茶園、葡萄園與甘蔗田");
assert(RECIPE_CATALOG.flourBatch.inputs.wheat === 2 && RECIPE_CATALOG.breadBatch.inputs.flour === 2, "小麥到麵粉再到麵包的三層產業鏈應完整");
assert(RECIPE_CATALOG.iceCreamBatch.inputs.milk === 1 && RECIPE_CATALOG.iceCreamBatch.inputs.sugar === 1 && RECIPE_CATALOG.iceCreamBatch.inputs.strawberry === 1, "冰淇淋屋應同時需要牛奶、砂糖與草莓");
assert(RECIPE_CATALOG.saplingHarvest.outputs.sapling === 3 && RECIPE_CATALOG.forestGrowth.inputs.sapling === 2 && RECIPE_CATALOG.lumberBatch.inputs.log === 2 && RECIPE_CATALOG.boatBuild.inputs.lumber === 6, "種樹、森林伐木、製材到造船的四層產業鏈應完整");
assert(RECIPE_CATALOG.oreMining.outputs.metalOre === 3 && RECIPE_CATALOG.metalPlateBatch.inputs.metalOre === 3 && RECIPE_CATALOG.planeBuild.inputs.metalPlate === 6, "金屬礦、冶煉到飛機工坊的造機鏈應完整");

let homeState = createIslandState({ playerAvatar: "cat", now });
assert.equal(islandInventoryCapacity(homeState), HOME_LEVELS[0].capacity, "島主小屋第一級應提供有限的初始倉庫容量");
for (let targetLevel = 2; targetLevel <= HOME_LEVELS.length; targetLevel += 1) {
  const upgrade = startHomeUpgrade(homeState, { workerId: "cat", playerAvatar: "cat", now });
  assert(upgrade.ok && upgrade.target.level === targetLevel, `島主小屋應可開始升到第 ${targetLevel} 級`);
  const finished = finishIslandWork(upgrade.state, { kind: "construction", id: upgrade.job.id, now: now + targetLevel });
  assert(finished.ok, `第 ${targetLevel} 級小屋工程應可完成`);
  homeState = finished.state;
}
assert.equal(homeState.buildings["starter-home"].level, 5, "島主小屋第五級應成為海島城堡");
assert.equal(islandInventoryCapacity(homeState), 1500, "海島城堡應提供最大倉庫容量");
assert(!startHomeUpgrade(homeState, { workerId: "cat", now }).ok, "海島城堡不可再升第六級");

let capacityState = createIslandState({ now });
capacityState.inventory.vegetable = islandInventoryCapacity(capacityState);
capacityState.buildings.fixture = { id: "fixture", buildingId: "ranch", q: 0, r: 1, orientation: 0, completedAt: now };
capacityState.facilities.fixture = { buildingInstanceId: "fixture", recipeId: "milkBatch", state: "idle", startedAt: 0, readyAt: 0, readyOutput: {}, readyOutputs: { milk: 1 }, updatedAt: now };
assert.equal(islandInventoryUsed(capacityState), islandInventoryCapacity(capacityState), "倉庫占用量應由所有品項數量加總");
const capacityBlocked = collectFacility(capacityState, { buildingInstanceId: "fixture", now });
assert(!capacityBlocked.ok && /容量不足/.test(capacityBlocked.error), "倉庫已滿時產品應留在設施等待，不能憑空消失");
const capacityUpgrade = startHomeUpgrade(capacityState, { workerId: "cat", now });
capacityState = finishIslandWork(capacityUpgrade.state, { kind: "construction", id: capacityUpgrade.job.id, now: now + 1 }).state;
assert(collectFacility(capacityState, { buildingInstanceId: "fixture", now: now + 2 }).ok, "小屋升級提高容量後應可領取原本卡住的產品");

let demolitionState = createIslandState({ now });
demolitionState.buildings.decor = { id: "decor", buildingId: "flowerGarden", q: 0, r: 1, orientation: 0, completedAt: now };
const demolition = startDemolition(demolitionState, { buildingInstanceId: "decor", workerId: "cat", playerAvatar: "cat", now });
assert(demolition.ok && demolition.job.kind === "demolition", "拆除設施也應建立占用伙伴的施工工作");
demolitionState = finishIslandWork(demolition.state, { kind: "construction", id: demolition.job.id, now: now + 1 }).state;
assert(!demolitionState.buildings.decor && demolitionState.statistics.demolished === 1, "拆除完工後才應移除設施並留下統計紀錄");

const attractionState = createIslandState({ playerAvatar: "cat", now });
attractionState.buildings["test-playground"] = { id: "test-playground", buildingId: "playground", q: 0, r: 1, orientation: 0, completedAt: now };
attractionState.lastSettledAt = now;
const attractionSettlement = settleIsland(attractionState, now + 40 * 60 * 1000);
assert.equal(attractionSettlement.coinsEarned, 6, "伙伴遊樂場每 20 分鐘應產生 3 金幣，離線 40 分鐘結算兩批");
assert(attractionSettlement.completed.some((entry) => entry.kind === "attraction"), "遊憩收入應進入真實時間結算結果");
assert(Object.values(attractionSettlement.state.statistics.visitors).reduce((total, count) => total + count, 0) >= 2, "每次遊憩結算應記錄實際來訪伙伴供排行統計");

let logisticsState = createIslandState({ playerId: "sender", playerName: "寄件島", now });
logisticsState.buildings["test-dock"] = { id: "test-dock", buildingId: "dock", q: 1, r: 0, orientation: 0, completedAt: now };
logisticsState.inventory.corn = 6;
logisticsState.inventory.boat = 1;
logisticsState.inventoryUpdatedAt = now;
const demoDad = DEMO_ISLAND_PARTNERS[0];
const milkOffer = demoDad.offers.find((offer) => offer.recipeId === "milkBatch");
assert.equal(availableTransportMethods(logisticsState)[0].availableVehicles, 1, "完工碼頭仍需至少一艘物流船才有可用海運班次");
const quote = shipmentQuote(logisticsState, { partner: demoDad, offer: milkOffer, methodId: "boat", quantity: 2 });
assert(quote.ok && quote.rewardCoins > ITEM_CATALOG.corn.marketCoins * 2, "跨島加工合作應比直接賣原料得到更多金幣");
const dispatched = dispatchDemoShipment(logisticsState, { partner: demoDad, offer: milkOffer, methodId: "boat", quantity: 2, now });
assert(dispatched.ok && dispatched.state.inventory.corn === 4 && dispatched.shipment.status === "in_transit", "確認出貨後應扣除庫存並建立在途事件");
logisticsState = dispatched.state;
const busyFleetQuote = shipmentQuote(logisticsState, { partner: demoDad, offer: milkOffer, methodId: "boat", quantity: 2 });
assert(!busyFleetQuote.ok && /都在運送中/.test(busyFleetQuote.error), "一艘船同時只能送一筆；增加船數才可增加併發物流");
const delivered = finishIslandWork(logisticsState, { kind: "shipment", id: dispatched.shipment.id, now: now + 1 });
assert(delivered.ok && delivered.coinsEarned === quote.rewardCoins && delivered.state.outgoingShipments[dispatched.shipment.id].status === "arrived_paid", "測試馬上完成應讓船運抵達且只結算一次報酬");
assert(delivered.state.thankYouLetters.some((letter) => letter.shipmentId === dispatched.shipment.id && !letter.read), "貨物到達時應為寄件島主建立只出現一次的未讀感謝函");
assert.equal(delivered.state.statistics.shipped.corn, 2, "出貨確認時應累積實際送出數量");

const marketTradeState = createIslandState({ playerId: "market-sender", now });
marketTradeState.buildings.dock = { id: "dock", buildingId: "dock", q: 1, r: 0, orientation: 0, completedAt: now };
marketTradeState.inventory.boat = 1;
marketTradeState.inventory.corn = 4;
const partnerMarketOffer = partnerLogisticsOffers(marketTradeState, demoDad).find((offer) => offer.kind === "market" && offer.itemId === "corn");
const partnerMarketQuote = shipmentQuote(marketTradeState, { partner: demoDad, offer: partnerMarketOffer, methodId: "boat", quantity: 2 });
assert(partnerMarketQuote.ok && partnerMarketQuote.rewardCoins >= Math.ceil(partnerMarketQuote.localMarketCoins * 1.7), "賣到其他玩家市場的價格應顯著高於本島市場直售");
const marketDispatched = dispatchDemoShipment(marketTradeState, { partner: demoDad, offer: partnerMarketOffer, methodId: "boat", quantity: 2, now });
assert(marketDispatched.ok && marketDispatched.state.statistics.partnerSold.corn === 2, "跨島市場交易應獨立記錄售出數量");

let airLogisticsState = createIslandState({ playerId: "air-sender", playerName: "空運島", now });
airLogisticsState.tiles[axialKey(2, -1)] = { terrain: "reclaimed", reclaimedAt: now };
airLogisticsState.buildings["test-airport"] = { id: "test-airport", buildingId: "airport", q: 1, r: -1, orientation: 0, completedAt: now };
airLogisticsState.inventory.corn = 2;
airLogisticsState.inventory.plane = 1;
const airDispatched = dispatchDemoShipment(airLogisticsState, { partner: demoDad, offer: milkOffer, methodId: "plane", quantity: 2, now });
assert(airDispatched.ok && airDispatched.shipment.methodId === "plane", "完工機場與足夠貨物應可建立空運事件");
airLogisticsState = airDispatched.state;

let receiverState = createIslandState({ playerId: "receiver", playerName: "收件島", now });
receiverState.buildings["remote-ranch"] = { id: "remote-ranch", buildingId: "ranch", q: 1, r: 0, orientation: 0, completedAt: now };
receiverState.facilities["remote-ranch"] = { buildingInstanceId: "remote-ranch", recipeId: "", state: "idle", startedAt: 0, readyAt: 0, readyOutput: {}, readyOutputs: {}, updatedAt: now };
const cloudPayload = {
  inboundShipments: [
    { id: "incoming-1", facilityInstanceId: "remote-ranch", buildingId: "ranch", recipeId: "milkBatch", itemId: "corn", inputPerBatch: 2, quantity: 2, arrivesAt: now, processingReadyAt: now + 7200000, senderName: "寄件島" },
    { id: "incoming-market", facilityInstanceId: "remote-market", buildingId: "market", recipeId: "marketSale:corn", itemId: "corn", inputPerBatch: 1, quantity: 2, arrivesAt: now, senderName: "市場寄件島" }
  ],
  rewardShipments: [{ id: "reward-1", rewardCoins: 30, partnerName: "老爸", partnerAvatar: "cow", itemId: "corn", quantity: 2 }]
};
const firstMerge = mergeCloudLogistics(receiverState, cloudPayload, now);
assert(firstMerge.coinsEarned === 30 && firstMerge.state.processingJobs["remote-incoming-1"], "雲端到站事件應自動進入對方加工設施並回收寄件報酬");
assert(firstMerge.ackInboundIds.includes("incoming-market") && !firstMerge.state.processingJobs["remote-incoming-market"], "送到其他玩家市場的貨物應直接成交，不可誤建加工批次");
assert(firstMerge.state.thankYouLetters.some((letter) => letter.shipmentId === "reward-1"), "雲端報酬第一次匯入時應建立國際感謝函");
const secondMerge = mergeCloudLogistics(firstMerge.state, cloudPayload, now + 1);
assert(secondMerge.coinsEarned === 0 && Object.keys(secondMerge.state.processingJobs).filter((id) => id === "remote-incoming-1").length === 1, "重複同步同一事件不可重複領錢或建立加工批次");

assert(/create table if not exists public\.island_network_profiles/.test(logisticsSql) && /create table if not exists public\.island_shipments/.test(logisticsSql), "物流 migration 應建立公開設施快照與事件表");
assert(/security definer/g.test(logisticsSql) && /dispatch_island_shipment/.test(logisticsSql) && /ack_island_logistics/.test(logisticsSql), "物流只能透過驗證 PIN 的安全 RPC 寫入與交接");
assert(/revoke all on public\.island_network_profiles, public\.island_recipe_catalog, public\.island_shipments from anon, authenticated/.test(logisticsSql), "玩家不可直接讀取他人的私人庫存或物流資料表");
assert(/'flourBatch', 'mill', 'wheat'/.test(logisticsSql) && /'sugarBatch', 'sugarMill', 'sugarcane'/.test(logisticsSql), "新增的單一原料加工鏈應同步到跨島物流配方目錄");
assert(/'marketSale:corn', 'market', 'corn'/.test(logisticsSql) && /market_facility_id/.test(logisticsSql), "雲端合作清單與安全 RPC 應支援其他玩家市場的高價收購");
assert(/vehicle_item := 'boat'/.test(logisticsSql) && /busy_vehicle_count/.test(logisticsSql), "雲端出貨也必須驗證物流船與飛機的持有量及併發占用");
assert(/jsonb_array_length\(p_buildings\) > 250/.test(logisticsSql) && /pg_column_size\(p_buildings\) > 100000/.test(logisticsSql), "半徑 8 地圖的雲端建物快照限制應同步放寬");

const logSource = createIslandState({ playerId: "log-source", now });
const logBuild = startBuilding(logSource, { buildingId: "garden", q: 0, r: 1, workerId: "cat", now });
const logCompleted = finishIslandWork(logBuild.state, { kind: "construction", id: logBuild.job.id, now: now + 1 }).state;
assert(logCompleted.constructionLog.some((entry) => entry.id === logBuild.job.id && entry.status === "completed"), "小島建設完工後應保留可同步的 LOG 事件");
const legacyLogState = JSON.parse(JSON.stringify(logCompleted));
delete legacyLogState.constructionLog;
assert(normalizeIslandState(legacyLogState, { now }).constructionLog.some((entry) => entry.buildingInstanceId && entry.status === "completed"), "舊版小島存檔應由現有建物補出建設 LOG");
const newerNonIslandSave = { island: createIslandState({ playerId: "log-source", now: now + 10_000 }), floors: { easy: 1, medium: 1, hard: 1, alin: 1 }, coins: 20 };
const mergedIslandSave = mergeProgressHighWater(newerNonIslandSave, { island: logCompleted, floors: newerNonIslandSave.floors, coins: 20 });
assert(Object.values(mergedIslandSave.island.buildings).some((building) => building.buildingId === "garden"), "較新的非小島存檔不可覆蓋另一台裝置已完工的建物");
assert(mergedIslandSave.island.constructionLog.some((entry) => entry.id === logBuild.job.id && entry.status === "completed"), "跨裝置合併後仍應保留小島建設 LOG");
const activeLogSource = createIslandState({ playerId: "active-log-source", now });
const activeLogBuild = startBuilding(activeLogSource, { buildingId: "garden", q: 0, r: 1, workerId: "cat", now });
const mergedActiveIsland = mergeProgressHighWater(newerNonIslandSave, { island: activeLogBuild.state, floors: newerNonIslandSave.floors, coins: 20 }).island;
assert(mergedActiveIsland.constructionJobs[activeLogBuild.job.id], "跨裝置合併也應保留尚未完工的小島工程");
const normalized = normalizeIslandState(JSON.parse(JSON.stringify(state)), { playerId: "test-player", now });
assert.equal(normalized.inventory.dairyBox, 1, "小島資料序列化後應可完整還原");
const legacyRadius = normalizeIslandState({ ...JSON.parse(JSON.stringify(state)), schemaVersion: 2, radius: 4 }, { playerId: "test-player", now });
assert.equal(legacyRadius.radius, 8, "舊版半徑 4 存檔正規化後應自動取得半徑 8 可開發範圍");
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
  selectedBuildingId: "flowerGarden",
  playerAvatar: "cat",
  testMode: true,
  now,
  version: "test"
});
const logisticsMarkup = renderIslandScreen({
  state: logisticsState,
  coins: 999,
  selectedKey: "0,0",
  partners: DEMO_ISLAND_PARTNERS,
  selectedPartnerId: demoDad.id,
  networkStatus: "測試物流已連線",
  workers: [{ id: "cat", name: "貓" }],
  selectedWorkerId: "cat",
  playerAvatar: "cat",
  testMode: true,
  now,
  version: "test"
});
const attractionMarkup = renderIslandScreen({
  state: attractionState,
  coins: 0,
  selectedKey: "0,1",
  workers: [{ id: "cat", name: "貓" }],
  selectedWorkerId: "cat",
  playerAvatar: "cat",
  testMode: true,
  now: now + 40 * 60 * 1000,
  version: "test"
});
const airLogisticsMarkup = renderIslandScreen({
  state: airLogisticsState,
  coins: 999,
  selectedKey: "0,0",
  partners: DEMO_ISLAND_PARTNERS,
  selectedPartnerId: demoDad.id,
  workers: [{ id: "cat", name: "貓" }],
  selectedWorkerId: "cat",
  playerAvatar: "cat",
  testMode: true,
  now,
  version: "test"
});
const noInputFactoryMarkup = renderIslandScreen({
  state: noInputState,
  coins: 999,
  selectedKey: `${factory.q},${factory.r}`,
  workers: [{ id: "cat", name: "貓" }],
  selectedWorkerId: "cat",
  playerAvatar: "cat",
  testMode: true,
  now,
  version: "test"
});
const shipmentMarkup = renderIslandScreen({
  state: logisticsState,
  coins: 999,
  selectedShipmentId: dispatched.shipment.id,
  partners: DEMO_ISLAND_PARTNERS,
  workers: [{ id: "cat", name: "貓" }],
  selectedWorkerId: "cat",
  playerAvatar: "cat",
  testMode: true,
  now,
  version: "test"
});
const statsMarkup = renderIslandScreen({
  state: delivered.state,
  coins: 999,
  showStats: true,
  workers: [{ id: "cat", name: "貓" }],
  selectedWorkerId: "cat",
  playerAvatar: "cat",
  testMode: true,
  now,
  version: "test"
});
const letterMarkup = renderIslandScreen({
  state: delivered.state,
  coins: 999,
  workers: [{ id: "cat", name: "貓" }],
  selectedWorkerId: "cat",
  playerAvatar: "cat",
  testMode: true,
  now,
  version: "test"
});
const hexButtons = markup.match(/<button class="island-hex[\s\S]*?<\/button>/g) || [];
assert(hexButtons.length === 217 && hexButtons.every((button) => !button.includes("data-island-ready-at")), "半徑 8 地圖應有 217 格，且施工倒數不可顯示在地圖六角格上");
assert(/目前進行中的工作/.test(markup) && /data-island-ready-at/.test(markup), "底部欄應改為顯示目前進行中的工作與時間");
assert(/島主小屋倉庫・\d+ \/ 80/.test(markup) && /data-island-upgrade-home/.test(markup) && !/class="island-inventory"/.test(markup), "庫存只應在點選島主小屋後顯示，並提供五級容量擴建入口");
assert(/data-island-finish-kind/.test(markup) && /測試資源 ∞/.test(markup), "測試模式應顯示無限資源與馬上完成按鈕");
assert(/data-island-zoom="out"/.test(markup) && /data-island-map-viewport/.test(markup), "縮放按鈕與滾輪事件接點應位於地圖區域");
assert(/island-build-category/.test(catalogMarkup) && /農業與採集/.test(catalogMarkup) && /加工與畜產/.test(catalogMarkup), "建築目錄應依用途顯示為巢狀分類");
assert(/金穗麥田/.test(catalogMarkup) && /星空溫泉/.test(catalogMarkup) && /冰淇淋屋/.test(catalogMarkup) && /造船廠/.test(catalogMarkup) && /飛機工坊/.test(catalogMarkup), "巢狀建築目錄應顯示新增的農業、景觀、加工與載具設施");
assert(/靈巧佈置|大力土木/.test(catalogMarkup), "施工伙伴選擇器應顯示伙伴能力");
assert(/island-partner-node/.test(logisticsMarkup) && /data-island-logistics-form/.test(logisticsMarkup) && /高價收購/.test(logisticsMarkup), "相容玩家應顯示在地圖邊緣，點選後提供加工或高價市場、物料、載具、數量、時間與報酬選單");
assert(/island-shore-foam/.test(logisticsMarkup), "陸地與海洋交界的六角邊應顯示白色浪花");
assert(!/island-shore-foam[^>]*>≈/.test(logisticsMarkup) && /radial-gradient\(ellipse at center/.test(islandStyles), "岸線應使用漸層海沫，不再以重複的波浪文字描邊");
assert(/clip-path:\s*polygon\(24% 0, 76% 0/.test(islandStyles), "陸地六角形應完整覆蓋格線，避免島中央露出藍色海縫");
assert(/island-transport-route is-boat/.test(logisticsMarkup) && /island-transport is-boat/.test(logisticsMarkup) && /從合作碼頭出發/.test(logisticsMarkup), "在途船運應從合作碼頭畫出點點路線並朝合作玩家移動");
const boatRouteCells = (logisticsMarkup.match(/class="island-transport-route is-boat"[^>]*data-island-route-cells="([^"]+)"/)?.[1] || "").split(";").filter(Boolean);
assert(boatRouteCells[0] === "2,0" && boatRouteCells.every((key) => !logisticsState.tiles[key]), "船運路線必須從碼頭水上格開始，且每個尋路節點都只能位於海洋格，不能穿過陸地");
assert(/island-transport-route is-plane/.test(airLogisticsMarkup) && /island-transport is-plane/.test(airLogisticsMarkup) && /從小島機場出發/.test(airLogisticsMarkup), "在途空運應從小島機場中心畫出點點路線並朝合作玩家移動");
assert(/已送出的送貨任務只能查看/.test(shipmentMarkup) && !/data-island-logistics-form/.test(shipmentMarkup), "已送出的物流工作應顯示唯讀明細，不能再出現可修改的出貨表單");
assert(/小島統計表/.test(statsMarkup) && /生產/.test(statsMarkup) && /送出/.test(statsMarkup) && /伙伴來訪排行/.test(statsMarkup) && /最近送貨/.test(statsMarkup), "統計表應同時呈現生產、送出、售出、遊客排行與物流紀錄");
assert(/AIR MAIL/.test(letterMarkup) && /跨島感謝函/.test(letterMarkup) && /data-island-dismiss-letter/.test(letterMarkup), "到貨時應彈出可愛國際航空信件格式的簡短感謝函");
assert(/island-attraction-visitors/.test(attractionMarkup) && /每 20 分鐘帶來 🪙 3/.test(attractionMarkup), "遊樂場應顯示隨機伙伴與定期門票收入說明");
assert(/data-island-process="dairyBatch"[^>]*disabled/.test(noInputFactoryMarkup) && /原料不足/.test(noInputFactoryMarkup), "食品工房沒有牛奶時，即使測試模式也必須停用加工按鈕");
assert(noInputFactoryMarkup.indexOf("data-island-process") < noInputFactoryMarkup.indexOf("island-production-guide"), "已完成設施應先顯示可操作的加工控制，再顯示產業鏈提示");
assert(/island-production-guide/.test(noInputFactoryMarkup) && /生產鏈提示/.test(noInputFactoryMarkup), "選取加工設施時應顯示生產鏈提示面板");
assert(/前端：原料從哪裡來/.test(noInputFactoryMarkup) && /後端：成品可以做什麼/.test(noInputFactoryMarkup), "生產鏈提示應同時顯示前端原料與後端用途");
assert(/data-island-production-item="milk"/.test(noInputFactoryMarkup) && /data-island-production-item="dairyBox"/.test(noInputFactoryMarkup), "生產鏈提示應列出設施的原料與成品");
assert(/pointerdown/.test(appSource) && /pointermove/.test(appSource) && /islandDragged/.test(appSource), "地圖應支援滑鼠與手機 Pointer Events 拖曳並防止拖後誤觸");
assert(!/setPointerCapture/.test(pointerDownSource) && /setPointerCapture/.test(pointerMoveSource), "一般點擊不可在 pointerdown 時被地圖接管，只有超過拖曳門檻後才能 capture");
assert(/touch-action:\s*none/.test(islandStyles) && /cursor:\s*grab/.test(islandStyles), "地圖拖曳應關閉瀏覽器手勢衝突並顯示拖曳游標");
assert(/\.island-hex\.is-ready\s*{[^}]*z-index:\s*12/.test(islandStyles), "可領取狀態的六角格必須高於選取與相鄰格");
assert(/\.island-ready-badge\s*{[^}]*z-index:\s*30[^}]*left:\s*50%/.test(islandStyles) && /translateX\(-50%\)[^}]*translateY\(-3px\)/.test(islandStyles), "驚嘆號應固定在六角格上緣中央且動畫不可破壞置中");
assert.equal(RECIPE_CATALOG.dairyBatch.outputs.dairyBox, 1, "配方目錄應保留可擴充的資料驅動輸出");

assert(/data-island-confirm-build/.test(appSource) && /collectIslandFacilitySafely/.test(appSource) && /saveCloudProgressIfCurrent/.test(appSource), "設施施工應先確認，收成應走雲端安全同步流程");
assert(/island-build-preview/.test(catalogMarkup) && /island-build-confirm-note/.test(islandStyles), "設施選擇後應顯示施工預覽與確認提示");
assert(/save_cloud_progress_if_current/.test(cloudConcurrencySql) && /p_expected_save_code/.test(cloudConcurrencySql) && /for update/i.test(cloudConcurrencySql) && /return false/.test(cloudConcurrencySql), "雲端收成 migration 應以鎖定與預期版本避免競爭覆寫");
assert(/islandViewScrollSnapshot/.test(appSource) && /workerPickerScrollTop/.test(appSource) && /restoreIslandViewScroll/.test(appSource), "小島面板重繪後應保留手機頁面與伙伴選擇器捲動位置");
const actionMarkupPosition = rendererSource.indexOf('definition.category === "source" ? sourcePanel');
const chainMarkupPosition = rendererSource.indexOf('${productionChainMarkup(building, facility)}');
assert(actionMarkupPosition >= 0 && chainMarkupPosition > actionMarkupPosition, "已完成設施的實際操作區應排在產業鏈提示之前");

console.log("Island foundation checks passed.");
