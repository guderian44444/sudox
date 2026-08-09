import {
  BUILDING_CATALOG,
  HOME_LEVELS,
  ISLAND_RADIUS,
  ISLAND_SCHEMA_VERSION,
  ITEM_CATALOG,
  RECLAMATION_WORK_TAGS,
  RECIPE_CATALOG,
  STARTER_LAND_RADIUS,
  reclamationQuote
} from "./catalog.js";
import { attractionVisitorIds } from "./attractions.js";
import { constructionTeamRate } from "./companions.js";
import { axialDistance, axialKey, axialNeighbors, footprintCells, hexRange, parseAxialKey } from "./hex.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const safeObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const safeInt = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : fallback;
const safeTime = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : fallback;

function operationId(prefix = "island") {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const normalizeInventory = (inventory = {}) => Object.fromEntries(Object.keys(ITEM_CATALOG).map((itemId) => [
  itemId,
  safeInt(inventory[itemId])
]));

const normalizeItemCounts = (counts = {}) => Object.fromEntries(Object.keys(ITEM_CATALOG).map((itemId) => [
  itemId,
  safeInt(counts[itemId])
]));

function emptyStatistics() {
  return {
    produced: normalizeItemCounts(),
    shipped: normalizeItemCounts(),
    sold: normalizeItemCounts(),
    partnerSold: normalizeItemCounts(),
    visitors: {},
    coins: { market: 0, logistics: 0, attractions: 0 },
    demolished: 0
  };
}

function normalizeStatistics(raw = {}) {
  const stats = safeObject(raw);
  const visitors = Object.fromEntries(Object.entries(safeObject(stats.visitors))
    .filter(([id]) => /^[a-z_][a-z0-9_-]{0,31}$/i.test(id))
    .slice(0, 100)
    .map(([id, count]) => [id, safeInt(count)]));
  return {
    produced: normalizeItemCounts(stats.produced),
    shipped: normalizeItemCounts(stats.shipped),
    sold: normalizeItemCounts(stats.sold),
    partnerSold: normalizeItemCounts(stats.partnerSold),
    visitors,
    coins: {
      market: safeInt(stats.coins?.market),
      logistics: safeInt(stats.coins?.logistics),
      attractions: safeInt(stats.coins?.attractions)
    },
    demolished: safeInt(stats.demolished)
  };
}

function addStatisticItems(stats, field, items) {
  stats[field] = normalizeItemCounts(stats[field]);
  Object.entries(safeObject(items)).forEach(([itemId, count]) => {
    if (ITEM_CATALOG[itemId]) stats[field][itemId] = safeInt(stats[field][itemId]) + safeInt(count);
  });
}

function starterTiles() {
  return Object.fromEntries(hexRange(STARTER_LAND_RADIUS).map(({ q, r }) => [
    axialKey(q, r),
    { terrain: "grass", reclaimedAt: 0 }
  ]));
}

function starterBuildings() {
  return {
    "starter-home": { id: "starter-home", buildingId: "islandHome", q: 0, r: 0, orientation: 0, level: 1, completedAt: 0 }
  };
}

export function createIslandState({ playerId = "", playerName = "", playerAvatar = "cat", now = Date.now() } = {}) {
  return {
    schemaVersion: ISLAND_SCHEMA_VERSION,
    id: `island-${playerId || operationId("guest")}`,
    playerId,
    name: playerName ? `${playerName}的小島` : "我的小島",
    radius: ISLAND_RADIUS,
    tiles: starterTiles(),
    buildings: starterBuildings(),
    constructionJobs: {},
    facilities: {},
    processingJobs: {},
    outgoingShipments: {},
    importedShipmentIds: [],
    rewardedShipmentIds: [],
    inventory: normalizeInventory(),
    statistics: emptyStatistics(),
    thankYouLetters: [],
    inventoryUpdatedAt: now,
    reclaimedCount: 0,
    starterGrantApplied: true,
    playerAvatar: playerAvatar || "cat",
    lastSettledAt: now,
    updatedAt: now
  };
}

export function normalizeIslandState(raw, owner = {}) {
  if (!raw || typeof raw !== "object" || ![1, 2, ISLAND_SCHEMA_VERSION].includes(Number(raw.schemaVersion))) {
    return createIslandState({ ...owner, now: owner.now || Date.now() });
  }
  const base = createIslandState({ ...owner, now: owner.now || Date.now() });
  const radius = ISLAND_RADIUS;
  const tiles = {};
  Object.entries(safeObject(raw.tiles)).forEach(([key, tile]) => {
    const cell = parseAxialKey(key);
    if (!cell || axialDistance(cell) > radius) return;
    tiles[key] = { terrain: tile?.terrain === "reclaimed" ? "reclaimed" : "grass", reclaimedAt: safeTime(tile?.reclaimedAt) };
  });
  Object.assign(tiles, starterTiles());

  const buildings = {};
  Object.entries(safeObject(raw.buildings)).forEach(([id, building]) => {
    const definition = BUILDING_CATALOG[building?.buildingId];
    if (!definition) return;
    const normalizedBuilding = {
      id,
      buildingId: building.buildingId,
      q: Math.trunc(Number(building.q) || 0),
      r: Math.trunc(Number(building.r) || 0),
      orientation: safeInt(building.orientation) % 6,
      level: building.buildingId === "islandHome" ? Math.max(1, Math.min(HOME_LEVELS.length, safeInt(building.level, 1))) : 1,
      completedAt: safeTime(building.completedAt)
    };
    const waterIndexes = new Set(definition.waterFootprintIndexes || []);
    const cells = footprintCells(normalizedBuilding, definition.footprint, normalizedBuilding.orientation);
    const valid = cells.every((cell, index) => waterIndexes.has(index)
      ? !tiles[axialKey(cell.q, cell.r)] && axialDistance(cell) <= radius
      : Boolean(tiles[axialKey(cell.q, cell.r)]));
    if (!valid) return;
    buildings[id] = normalizedBuilding;
  });
  if (!buildings["starter-home"]) buildings["starter-home"] = base.buildings["starter-home"];

  return {
    ...base,
    ...raw,
    schemaVersion: ISLAND_SCHEMA_VERSION,
    playerId: owner.playerId || raw.playerId || "",
    name: typeof raw.name === "string" ? raw.name.slice(0, 32) : base.name,
    radius,
    tiles,
    buildings,
    constructionJobs: safeObject(raw.constructionJobs),
    facilities: safeObject(raw.facilities),
    processingJobs: safeObject(raw.processingJobs),
    outgoingShipments: safeObject(raw.outgoingShipments),
    importedShipmentIds: [...new Set(Array.isArray(raw.importedShipmentIds) ? raw.importedShipmentIds.filter((id) => typeof id === "string").slice(-200) : [])],
    rewardedShipmentIds: [...new Set(Array.isArray(raw.rewardedShipmentIds) ? raw.rewardedShipmentIds.filter((id) => typeof id === "string").slice(-200) : [])],
    inventory: normalizeInventory(raw.inventory),
    statistics: normalizeStatistics(raw.statistics),
    thankYouLetters: (Array.isArray(raw.thankYouLetters) ? raw.thankYouLetters : []).filter((letter) => letter?.id).slice(-50).map((letter) => ({
      id: String(letter.id).slice(0, 80),
      shipmentId: String(letter.shipmentId || letter.id).slice(0, 80),
      fromName: String(letter.fromName || "合作島友").slice(0, 24),
      fromAvatar: String(letter.fromAvatar || "cat").slice(0, 32),
      itemId: ITEM_CATALOG[letter.itemId] ? letter.itemId : "",
      quantity: safeInt(letter.quantity),
      receivedAt: safeTime(letter.receivedAt),
      read: Boolean(letter.read)
    })),
    inventoryUpdatedAt: safeTime(raw.inventoryUpdatedAt) || safeTime(raw.updatedAt) || base.inventoryUpdatedAt,
    reclaimedCount: safeInt(raw.reclaimedCount),
    starterGrantApplied: raw.starterGrantApplied !== false,
    playerAvatar: owner.playerAvatar || raw.playerAvatar || "cat",
    lastSettledAt: safeTime(raw.lastSettledAt, owner.now || Date.now()),
    updatedAt: safeTime(raw.updatedAt, owner.now || Date.now())
  };
}

export function islandHomeBuilding(state) {
  return Object.values(state?.buildings || {}).find((building) => building.buildingId === "islandHome") || null;
}

export function islandHomeLevel(state) {
  const building = islandHomeBuilding(state);
  const level = Math.max(1, Math.min(HOME_LEVELS.length, safeInt(building?.level, 1)));
  return HOME_LEVELS[level - 1];
}

export function islandInventoryCapacity(state) {
  return islandHomeLevel(state).capacity;
}

export function islandInventoryUsed(state) {
  return Object.keys(ITEM_CATALOG).reduce((total, itemId) => total + safeInt(state?.inventory?.[itemId]), 0);
}

export function activeVehicleCount(state, methodId) {
  return Object.values(state?.outgoingShipments || {}).filter((shipment) => shipment.methodId === methodId && shipment.status === "in_transit").length;
}

export function availableInventoryQuantity(state, itemId) {
  const owned = safeInt(state?.inventory?.[itemId]);
  const methodId = ITEM_CATALOG[itemId]?.vehicleMethodId;
  return methodId ? Math.max(0, owned - activeVehicleCount(state, methodId)) : owned;
}

export function buildingAnchorAt(state, q, r) {
  return Object.values(state.buildings).find((building) => building.q === q && building.r === r) || null;
}

export function buildingAt(state, q, r) {
  return Object.values(state.buildings).find((building) => {
    const definition = BUILDING_CATALOG[building.buildingId];
    return footprintCells(building, definition?.footprint, building.orientation).some((cell) => cell.q === q && cell.r === r);
  }) || null;
}

export function constructionAnchorAt(state, q, r) {
  return Object.values(state.constructionJobs).find((job) => job.q === q && job.r === r) || null;
}

export function constructionAt(state, q, r) {
  return Object.values(state.constructionJobs).find((job) => {
    if (!["building", "demolition"].includes(job.kind)) return job.q === q && job.r === r;
    const definition = BUILDING_CATALOG[job.buildingId];
    return footprintCells(job, definition?.footprint, job.orientation).some((cell) => cell.q === q && cell.r === r);
  }) || null;
}

export function isTileOccupied(state, q, r) {
  return Boolean(buildingAt(state, q, r) || constructionAt(state, q, r));
}

export function isReclaimable(state, q, r) {
  const key = axialKey(q, r);
  if (state.tiles[key] || axialDistance({ q, r }) > state.radius || constructionAt(state, q, r) || buildingAt(state, q, r)) return false;
  return axialNeighbors(q, r).some((neighbor) => Boolean(state.tiles[axialKey(neighbor.q, neighbor.r)]));
}

function canPlaceBuilding(state, definition, q, r, orientation = 0) {
  const cells = footprintCells({ q, r }, definition.footprint, orientation);
  const waterIndexes = new Set(definition.waterFootprintIndexes || []);
  return cells.every((cell, index) => {
    if (axialDistance(cell) > state.radius || isTileOccupied(state, cell.q, cell.r)) return false;
    return waterIndexes.has(index) ? !state.tiles[axialKey(cell.q, cell.r)] : Boolean(state.tiles[axialKey(cell.q, cell.r)]);
  });
}

function resolveBuildingOrientation(state, definition, q, r, preferredOrientation) {
  const preferred = preferredOrientation === null || preferredOrientation === undefined
    ? null
    : Number.isFinite(Number(preferredOrientation)) ? safeInt(preferredOrientation) % 6 : null;
  const candidates = preferred === null ? [0, 1, 2, 3, 4, 5] : [preferred];
  return candidates.find((orientation) => canPlaceBuilding(state, definition, q, r, orientation));
}

function baseJob({ kind, q, r, costCoins, durationSeconds, workerId, workTags = [], now }) {
  const workerIds = [workerId || "cat"];
  const teamRate = constructionTeamRate(workerIds, workTags);
  return {
    id: operationId(kind),
    kind,
    q,
    r,
    costCoins,
    startedAt: now,
    readyAt: now + (durationSeconds * 1000) / teamRate,
    baseDurationSeconds: durationSeconds,
    workTags: [...workTags],
    teamRate,
    workerIds,
    status: "building"
  };
}

export function busyConstructionWorkerIds(state) {
  return [...new Set(Object.values(state?.constructionJobs || {}).flatMap((job) => job.workerIds || []))];
}

export function availableConstructionWorkerIds(state, rosterIds = []) {
  const busy = new Set(busyConstructionWorkerIds(state));
  return rosterIds.filter((id) => id && !busy.has(id));
}

export function initialWorkerHireCost(workerId, playerAvatar, baseCost = 0) {
  if (!workerId || workerId === playerAvatar) return 0;
  return Math.max(8, Math.ceil(safeInt(baseCost) * 0.1));
}

function workerBusy(state, workerId) {
  return !workerId || busyConstructionWorkerIds(state).includes(workerId);
}

function buildingUnderStructuralWork(state, buildingInstanceId) {
  return Object.values(state?.constructionJobs || {}).some((job) => job.buildingInstanceId === buildingInstanceId);
}

export function startReclamation(state, { q, r, workerId = "cat", playerAvatar = "cat", now = Date.now() } = {}) {
  if (!isReclaimable(state, q, r)) return { ok: false, state, error: "這格海域目前不能填海" };
  if (workerBusy(state, workerId)) return { ok: false, state, error: "這位伙伴已經在忙，請另外聘一位伙伴" };
  const quote = reclamationQuote(state.reclaimedCount);
  const workerHireCost = initialWorkerHireCost(workerId, playerAvatar, quote.costCoins);
  const next = clone(state);
  const job = baseJob({ kind: "reclaim", q, r, ...quote, workerId, workTags: RECLAMATION_WORK_TAGS, now });
  job.workerHireCost = workerHireCost;
  next.constructionJobs[job.id] = job;
  next.updatedAt = now;
  return { ok: true, state: next, costCoins: quote.costCoins + workerHireCost, workerHireCost, job };
}

export function startBuilding(state, { buildingId, q, r, orientation = null, workerId = "cat", playerAvatar = "cat", now = Date.now() } = {}) {
  const definition = BUILDING_CATALOG[buildingId];
  if (!definition?.buildable) return { ok: false, state, error: "這項設施尚未開放建造" };
  const resolvedOrientation = resolveBuildingOrientation(state, definition, q, r, orientation);
  if (resolvedOrientation === undefined) return { ok: false, state, error: definition.waterFootprintIndexes?.length ? "碼頭需要一格海岸土地與相鄰海面" : "這個位置放不下該設施" };
  if (workerBusy(state, workerId)) return { ok: false, state, error: "這位伙伴已經在忙，請另外聘一位伙伴" };
  const workerHireCost = initialWorkerHireCost(workerId, playerAvatar, definition.costCoins);
  const next = clone(state);
  const job = {
    ...baseJob({ kind: "building", q, r, costCoins: definition.costCoins, durationSeconds: definition.durationSeconds, workerId, workTags: definition.workTags, now }),
    buildingId,
    workerHireCost,
    orientation: resolvedOrientation
  };
  next.constructionJobs[job.id] = job;
  next.updatedAt = now;
  return { ok: true, state: next, costCoins: definition.costCoins + workerHireCost, workerHireCost, job };
}

export function startHomeUpgrade(state, { workerId = "cat", playerAvatar = "cat", now = Date.now() } = {}) {
  const home = islandHomeBuilding(state);
  const current = islandHomeLevel(state);
  const target = HOME_LEVELS[current.level];
  if (!home || !target) return { ok: false, state, error: "島主小屋已經是最高等級的海島城堡" };
  if (Object.values(state.constructionJobs).some((job) => job.buildingInstanceId === home.id)) return { ok: false, state, error: "島主小屋目前已有工程進行中" };
  if (workerBusy(state, workerId)) return { ok: false, state, error: "這位伙伴已經在忙，請另外聘一位伙伴" };
  const workerHireCost = initialWorkerHireCost(workerId, playerAvatar, target.costCoins);
  const next = clone(state);
  const job = {
    ...baseJob({ kind: "homeUpgrade", q: home.q, r: home.r, costCoins: target.costCoins, durationSeconds: target.durationSeconds, workerId, workTags: target.workTags, now }),
    buildingInstanceId: home.id,
    buildingId: "islandHome",
    targetLevel: target.level,
    workerHireCost
  };
  next.constructionJobs[job.id] = job;
  next.updatedAt = now;
  return { ok: true, state: next, costCoins: target.costCoins + workerHireCost, workerHireCost, job, target };
}

export function startDemolition(state, { buildingInstanceId, workerId = "cat", playerAvatar = "cat", now = Date.now() } = {}) {
  const building = state.buildings[buildingInstanceId];
  const definition = BUILDING_CATALOG[building?.buildingId];
  if (!building || !definition) return { ok: false, state, error: "找不到要拆除的設施" };
  if (building.buildingId === "islandHome") return { ok: false, state, error: "島主小屋兼作倉庫，不能拆除，只能升級擴建" };
  if (Object.values(state.constructionJobs).some((job) => job.buildingInstanceId === building.id)) return { ok: false, state, error: "這座設施目前已有工程進行中" };
  if (Object.values(state.processingJobs).some((job) => job.buildingInstanceId === building.id)) return { ok: false, state, error: "請先等這座設施的加工批次完成並領取" };
  const facility = state.facilities[building.id];
  if (facility?.state === "ready" || Object.values(facility?.readyOutputs || {}).some((count) => safeInt(count) > 0)) {
    return { ok: false, state, error: "請先領取這座設施中已完成的產品" };
  }
  const methodId = building.buildingId === "dock" ? "boat" : building.buildingId === "airport" ? "plane" : "";
  if (methodId && activeVehicleCount(state, methodId)) return { ok: false, state, error: "仍有載具從這座物流設施出發，抵達後才能拆除" };
  if (workerBusy(state, workerId)) return { ok: false, state, error: "這位伙伴已經在忙，請另外聘一位伙伴" };
  const durationSeconds = Math.min(4 * 60 * 60, Math.max(10 * 60, Math.ceil(definition.durationSeconds * 0.25)));
  const workerHireCost = initialWorkerHireCost(workerId, playerAvatar, Math.max(40, Math.ceil(definition.costCoins * 0.25)));
  const next = clone(state);
  const job = {
    ...baseJob({ kind: "demolition", q: building.q, r: building.r, costCoins: 0, durationSeconds, workerId, workTags: definition.workTags, now }),
    buildingInstanceId: building.id,
    buildingId: building.buildingId,
    orientation: building.orientation,
    workerHireCost
  };
  next.constructionJobs[job.id] = job;
  next.updatedAt = now;
  return { ok: true, state: next, costCoins: workerHireCost, workerHireCost, job };
}

export function constructionJobWorkTags(job) {
  if (Array.isArray(job?.workTags) && job.workTags.length) return job.workTags;
  if (job?.kind === "reclaim") return RECLAMATION_WORK_TAGS;
  return BUILDING_CATALOG[job?.buildingId]?.workTags || [];
}

const legacyWorkerRate = (count) => count >= 3 ? 2 : count === 2 ? 1.5 : 1;

export function helperQuote(job) {
  if (!job || job.workerIds?.length >= 3) return null;
  const percentage = job.workerIds?.length === 1 ? 0.15 : 0.25;
  const minimum = job.workerIds?.length === 1 ? 8 : 12;
  return Math.max(minimum, Math.ceil(safeInt(job.costCoins) * percentage));
}

export function hireConstructionHelper(state, { jobId, helperId, now = Date.now() } = {}) {
  const current = state.constructionJobs[jobId];
  const costCoins = helperQuote(current);
  if (!current || !costCoins) return { ok: false, state, error: "這項工程不能再增加幫手" };
  if (!helperId || current.workerIds.includes(helperId)) return { ok: false, state, error: "請選擇不同的伙伴" };
  if (busyConstructionWorkerIds(state).includes(helperId)) return { ok: false, state, error: "這位伙伴正在其他工程工作" };
  if (safeTime(current.readyAt) <= now) return { ok: false, state, error: "工程已完成，無需再增加伙伴" };
  const next = clone(state);
  const job = next.constructionJobs[jobId];
  const workTags = constructionJobWorkTags(job);
  const oldRate = Number(job.teamRate) > 0 ? Number(job.teamRate) : legacyWorkerRate(job.workerIds.length);
  const remainingWorkMs = Math.max(0, job.readyAt - now) * oldRate;
  job.workerIds.push(helperId);
  job.workTags = [...workTags];
  job.teamRate = constructionTeamRate(job.workerIds, workTags);
  job.readyAt = now + remainingWorkMs / job.teamRate;
  next.updatedAt = now;
  return { ok: true, state: next, costCoins, job };
}

function createFacility(building, completedAt) {
  const definition = BUILDING_CATALOG[building.buildingId];
  const recipe = RECIPE_CATALOG[definition?.defaultRecipeId];
  return {
    buildingInstanceId: building.id,
    recipeId: recipe?.id || "",
    state: recipe?.kind === "source" ? "running" : "idle",
    startedAt: recipe?.kind === "source" ? completedAt : 0,
    readyAt: recipe?.kind === "source" ? completedAt + recipe.durationSeconds * 1000 : 0,
    readyOutput: {},
    readyOutputs: {},
    updatedAt: completedAt
  };
}

export function selectSourceRecipe(state, { buildingInstanceId, recipeId, now = Date.now() } = {}) {
  const settled = settleIsland(state, now).state;
  if (buildingUnderStructuralWork(settled, buildingInstanceId)) return { ok: false, state: settled, error: "這座設施正在施工，暫時不能切換生產" };
  const building = settled.buildings[buildingInstanceId];
  const definition = BUILDING_CATALOG[building?.buildingId];
  const facility = settled.facilities[buildingInstanceId];
  const recipe = RECIPE_CATALOG[recipeId];
  const allowedRecipeIds = definition?.recipeIds || (definition?.defaultRecipeId ? [definition.defaultRecipeId] : []);
  if (!building || !facility || recipe?.kind !== "source" || recipe.facilityId !== definition?.id || !allowedRecipeIds.includes(recipeId)) {
    return { ok: false, state: settled, error: "這座設施不能生產該品項" };
  }
  if (facility.state === "ready") return { ok: false, state: settled, error: "請先收成目前的產品再更換" };
  if (facility.recipeId === recipeId && facility.state === "running") return { ok: false, state: settled, error: "目前已經在生產這個品項" };
  const next = clone(settled);
  const target = next.facilities[buildingInstanceId];
  target.recipeId = recipeId;
  target.state = "running";
  target.startedAt = now;
  target.readyAt = now + recipe.durationSeconds * 1000;
  target.readyOutput = {};
  target.updatedAt = now;
  next.updatedAt = now;
  return { ok: true, state: next, recipe };
}

function appendThankYouLetter(state, shipment, receivedAt) {
  state.thankYouLetters = Array.isArray(state.thankYouLetters) ? state.thankYouLetters : [];
  if (!shipment?.id || state.thankYouLetters.some((letter) => letter.shipmentId === shipment.id)) return;
  state.thankYouLetters.push({
    id: `letter-${shipment.id}`,
    shipmentId: shipment.id,
    fromName: shipment.partnerName || "合作島友",
    fromAvatar: shipment.partnerAvatar || "cat",
    itemId: ITEM_CATALOG[shipment.itemId] ? shipment.itemId : "",
    quantity: safeInt(shipment.quantity),
    receivedAt,
    read: false
  });
  state.thankYouLetters = state.thankYouLetters.slice(-50);
}

export function settleIsland(state, now = Date.now()) {
  const next = clone(state);
  next.statistics = normalizeStatistics(next.statistics);
  next.thankYouLetters = Array.isArray(next.thankYouLetters) ? next.thankYouLetters : [];
  const completed = [];
  let changed = false;
  let coinsEarned = 0;
  const previousSettledAt = Math.min(now, safeTime(state.lastSettledAt, now));

  Object.entries(next.constructionJobs).forEach(([jobId, job]) => {
    if (safeTime(job.readyAt) > now) return;
    if (job.kind === "reclaim") {
      next.tiles[axialKey(job.q, job.r)] = { terrain: "reclaimed", reclaimedAt: job.readyAt };
      next.reclaimedCount = safeInt(next.reclaimedCount) + 1;
      completed.push({ kind: "reclaim", name: "填海造陸", q: job.q, r: job.r });
    } else if (job.kind === "building" && BUILDING_CATALOG[job.buildingId]) {
      const building = {
        id: operationId("building"),
        buildingId: job.buildingId,
        q: job.q,
        r: job.r,
        orientation: safeInt(job.orientation) % 6,
        level: 1,
        completedAt: job.readyAt
      };
      next.buildings[building.id] = building;
      const definition = BUILDING_CATALOG[building.buildingId];
      if (definition.defaultRecipeId || definition.recipeIds?.length) next.facilities[building.id] = createFacility(building, job.readyAt);
      completed.push({ kind: "building", name: definition.name, q: job.q, r: job.r });
    } else if (job.kind === "homeUpgrade" && HOME_LEVELS[safeInt(job.targetLevel) - 1]) {
      const home = next.buildings[job.buildingInstanceId];
      const target = HOME_LEVELS[safeInt(job.targetLevel) - 1];
      if (home?.buildingId === "islandHome") {
        home.level = target.level;
        completed.push({ kind: "homeUpgrade", name: `${target.name}升級`, q: home.q, r: home.r });
      }
    } else if (job.kind === "demolition") {
      const building = next.buildings[job.buildingInstanceId];
      const definition = BUILDING_CATALOG[building?.buildingId];
      if (building && building.buildingId !== "islandHome") {
        delete next.facilities[building.id];
        delete next.buildings[building.id];
        next.statistics.demolished = safeInt(next.statistics.demolished) + 1;
        completed.push({ kind: "demolition", name: `拆除${definition?.name || "設施"}`, q: building.q, r: building.r });
      }
    }
    delete next.constructionJobs[jobId];
    changed = true;
  });

  Object.values(next.facilities).forEach((facility) => {
    const recipe = RECIPE_CATALOG[facility.recipeId];
    if (recipe?.kind !== "source" || facility.state !== "running" || safeTime(facility.readyAt) > now) return;
    facility.state = "ready";
    facility.readyOutput = clone(recipe.outputs);
    addStatisticItems(next.statistics, "produced", recipe.outputs);
    facility.updatedAt = now;
    changed = true;
  });

  Object.entries(next.processingJobs).forEach(([jobId, job]) => {
    if (safeTime(job.readyAt) > now) return;
    const facility = next.facilities[job.buildingInstanceId];
    if (facility) {
      facility.readyOutputs = safeObject(facility.readyOutputs);
      Object.entries(safeObject(job.outputs)).forEach(([itemId, count]) => {
        if (!ITEM_CATALOG[itemId]) return;
        facility.readyOutputs[itemId] = safeInt(facility.readyOutputs[itemId]) + safeInt(count);
      });
      addStatisticItems(next.statistics, "produced", job.outputs);
      facility.updatedAt = now;
      completed.push({ kind: "processing", name: RECIPE_CATALOG[job.recipeId]?.name || "加工", buildingInstanceId: job.buildingInstanceId });
    }
    delete next.processingJobs[jobId];
    changed = true;
  });

  Object.entries(next.outgoingShipments || {}).forEach(([shipmentId, shipment]) => {
    if (shipment.mode !== "demo" || shipment.status !== "in_transit" || safeTime(shipment.arrivesAt) > now) return;
    shipment.status = "arrived_paid";
    shipment.completedAt = now;
    coinsEarned += safeInt(shipment.rewardCoins);
    next.statistics.coins.logistics += safeInt(shipment.rewardCoins);
    appendThankYouLetter(next, shipment, now);
    completed.push({ kind: "shipment", name: `送達 ${shipment.partnerName || "合作小島"}` });
    changed = true;
  });

  let attractionCoins = 0;
  Object.values(next.buildings).forEach((building) => {
    const attraction = BUILDING_CATALOG[building.buildingId]?.attraction;
    const intervalMs = safeInt(attraction?.intervalSeconds) * 1000;
    if (!intervalMs || !safeInt(attraction?.incomeCoins)) return;
    const completedAt = safeTime(building.completedAt);
    const from = Math.max(previousSettledAt, completedAt);
    const visitsBefore = Math.floor(Math.max(0, from - completedAt) / intervalMs);
    const visitsNow = Math.floor(Math.max(0, now - completedAt) / intervalMs);
    const visitCount = Math.max(0, visitsNow - visitsBefore);
    attractionCoins += visitCount * safeInt(attraction.incomeCoins);
    for (let visitIndex = visitsBefore + 1; visitIndex <= visitsNow; visitIndex += 1) {
      attractionVisitorIds(building, BUILDING_CATALOG[building.buildingId], visitIndex).forEach((visitorId) => {
        next.statistics.visitors[visitorId] = safeInt(next.statistics.visitors[visitorId]) + 1;
      });
    }
  });
  if (attractionCoins) {
    coinsEarned += attractionCoins;
    next.statistics.coins.attractions += attractionCoins;
    completed.push({ kind: "attraction", name: `遊憩設施收入 🪙 ${attractionCoins}` });
    changed = true;
  }

  if (changed) next.updatedAt = now;
  next.lastSettledAt = now;
  return { state: next, changed, completed, coinsEarned };
}

function addInventory(inventory, items) {
  Object.entries(safeObject(items)).forEach(([itemId, count]) => {
    if (!ITEM_CATALOG[itemId]) return;
    inventory[itemId] = safeInt(inventory[itemId]) + safeInt(count);
  });
}

export function collectFacility(state, { buildingInstanceId, now = Date.now() } = {}) {
  const settled = settleIsland(state, now).state;
  const facility = settled.facilities[buildingInstanceId];
  if (!facility) return { ok: false, state: settled, error: "這座設施目前沒有產品" };
  const collected = {};
  if (facility.state === "ready" && Object.keys(facility.readyOutput || {}).length) {
    Object.assign(collected, facility.readyOutput);
  }
  if (Object.keys(facility.readyOutputs || {}).length) {
    Object.entries(facility.readyOutputs).forEach(([itemId, count]) => {
      collected[itemId] = safeInt(collected[itemId]) + safeInt(count);
    });
  }
  if (!Object.keys(collected).length) return { ok: false, state: settled, error: "產品還在準備中" };
  const itemCount = Object.values(collected).reduce((total, count) => total + safeInt(count), 0);
  const used = islandInventoryUsed(settled);
  const capacity = islandInventoryCapacity(settled);
  if (used + itemCount > capacity) {
    return { ok: false, state: settled, error: `倉庫容量不足（已用 ${used} / ${capacity}），請先出售、出貨或升級島主小屋` };
  }
  const next = clone(settled);
  const target = next.facilities[buildingInstanceId];
  addInventory(next.inventory, collected);
  if (target.state === "ready" && Object.keys(target.readyOutput || {}).length) {
    const recipe = RECIPE_CATALOG[target.recipeId];
    target.state = "running";
    target.startedAt = now;
    target.readyAt = now + recipe.durationSeconds * 1000;
    target.readyOutput = {};
  }
  if (Object.keys(target.readyOutputs || {}).length) target.readyOutputs = {};
  next.inventoryUpdatedAt = now;
  target.updatedAt = now;
  next.updatedAt = now;
  return { ok: true, state: next, collected };
}

const hasInputs = (inventory, inputs) => Object.entries(inputs).every(([itemId, count]) => safeInt(inventory[itemId]) >= safeInt(count));

export function startProcessing(state, { buildingInstanceId, recipeId, now = Date.now() } = {}) {
  const building = state.buildings[buildingInstanceId];
  const definition = BUILDING_CATALOG[building?.buildingId];
  const recipe = RECIPE_CATALOG[recipeId];
  if (!building || !recipe || recipe.kind !== "processor" || recipe.facilityId !== definition?.id) {
    return { ok: false, state, error: "這座設施不能使用該配方" };
  }
  if (buildingUnderStructuralWork(state, buildingInstanceId)) return { ok: false, state, error: "這座設施正在施工，暫時不能開始加工" };
  if (!hasInputs(state.inventory, recipe.inputs)) return { ok: false, state, error: "倉庫原料不足，單有加工設施不能生產" };
  const next = clone(state);
  Object.entries(recipe.inputs).forEach(([itemId, count]) => { next.inventory[itemId] -= count; });
  next.inventoryUpdatedAt = now;
  const job = {
    id: operationId("processing"),
    buildingInstanceId,
    recipeId,
    inputs: clone(recipe.inputs),
    outputs: clone(recipe.outputs),
    startedAt: now,
    readyAt: now + recipe.durationSeconds * 1000,
    source: "local"
  };
  next.processingJobs[job.id] = job;
  next.updatedAt = now;
  return { ok: true, state: next, job };
}

export function marketSale(state, { itemId, quantity = 1, now = Date.now() } = {}) {
  const item = ITEM_CATALOG[itemId];
  const count = Math.max(1, safeInt(quantity, 1));
  const hasMarket = Object.values(state.buildings).some((building) => building.buildingId === "market");
  if (!hasMarket) return { ok: false, state, error: "先建造小島市場才能出售產品" };
  if (!item || availableInventoryQuantity(state, itemId) < count) return { ok: false, state, error: item?.vehicleMethodId ? "部分載具仍在運送中，不能出售" : "倉庫數量不足" };
  const next = clone(state);
  next.statistics = normalizeStatistics(next.statistics);
  next.inventory[itemId] -= count;
  next.statistics.sold[itemId] += count;
  next.statistics.coins.market += item.marketCoins * count;
  next.inventoryUpdatedAt = now;
  next.updatedAt = now;
  return { ok: true, state: next, coinsEarned: item.marketCoins * count, sold: { itemId, quantity: count } };
}

export function dismissIslandLetter(state, letterId, now = Date.now()) {
  const next = clone(state);
  const letter = (next.thankYouLetters || []).find((entry) => entry.id === letterId);
  if (!letter) return { ok: false, state, error: "找不到這封感謝函" };
  letter.read = true;
  next.updatedAt = now;
  return { ok: true, state: next };
}

export function availableHelperIds(state, rosterIds = [], playerAvatar = "") {
  const busy = new Set(Object.values(state.constructionJobs).flatMap((job) => job.workerIds || []));
  return rosterIds.filter((id) => id && !busy.has(id));
}

export function finishIslandWork(state, { kind, id, now = Date.now() } = {}) {
  const next = clone(state);
  if (kind === "construction" && next.constructionJobs[id]) next.constructionJobs[id].readyAt = now;
  else if (kind === "processing" && next.processingJobs[id]) next.processingJobs[id].readyAt = now;
  else if (kind === "source" && next.facilities[id]?.state === "running") next.facilities[id].readyAt = now;
  else if (kind === "shipment" && next.outgoingShipments?.[id]?.mode === "demo" && next.outgoingShipments[id].status === "in_transit") next.outgoingShipments[id].arrivesAt = now;
  else return { ok: false, state, error: "找不到可馬上完成的工作" };
  const settled = settleIsland(next, now);
  return { ok: true, state: settled.state, completed: settled.completed, coinsEarned: settled.coinsEarned };
}
