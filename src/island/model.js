import {
  BUILDING_CATALOG,
  ISLAND_RADIUS,
  ISLAND_SCHEMA_VERSION,
  ITEM_CATALOG,
  RECLAMATION_WORK_TAGS,
  RECIPE_CATALOG,
  STARTER_LAND_RADIUS,
  reclamationQuote
} from "./catalog.js";
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

function starterTiles() {
  return Object.fromEntries(hexRange(STARTER_LAND_RADIUS).map(({ q, r }) => [
    axialKey(q, r),
    { terrain: "grass", reclaimedAt: 0 }
  ]));
}

function starterBuildings() {
  return {
    "starter-home": { id: "starter-home", buildingId: "islandHome", q: 0, r: 0, orientation: 0, completedAt: 0 }
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
    inventory: normalizeInventory(),
    reclaimedCount: 0,
    starterGrantApplied: true,
    playerAvatar: playerAvatar || "cat",
    lastSettledAt: now,
    updatedAt: now
  };
}

export function normalizeIslandState(raw, owner = {}) {
  if (!raw || typeof raw !== "object" || Number(raw.schemaVersion) !== ISLAND_SCHEMA_VERSION) {
    return createIslandState({ ...owner, now: owner.now || Date.now() });
  }
  const base = createIslandState({ ...owner, now: owner.now || Date.now() });
  const radius = Math.max(STARTER_LAND_RADIUS, Math.min(ISLAND_RADIUS, safeInt(raw.radius, ISLAND_RADIUS)));
  const tiles = {};
  Object.entries(safeObject(raw.tiles)).forEach(([key, tile]) => {
    const cell = parseAxialKey(key);
    if (!cell || axialDistance(cell) > radius) return;
    tiles[key] = { terrain: tile?.terrain === "reclaimed" ? "reclaimed" : "grass", reclaimedAt: safeTime(tile?.reclaimedAt) };
  });
  Object.assign(tiles, starterTiles());

  const buildings = {};
  Object.entries(safeObject(raw.buildings)).forEach(([id, building]) => {
    if (!BUILDING_CATALOG[building?.buildingId]) return;
    const key = axialKey(building.q, building.r);
    if (!tiles[key]) return;
    buildings[id] = {
      id,
      buildingId: building.buildingId,
      q: Math.trunc(Number(building.q) || 0),
      r: Math.trunc(Number(building.r) || 0),
      orientation: safeInt(building.orientation) % 6,
      completedAt: safeTime(building.completedAt)
    };
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
    inventory: normalizeInventory(raw.inventory),
    reclaimedCount: safeInt(raw.reclaimedCount),
    starterGrantApplied: raw.starterGrantApplied !== false,
    playerAvatar: owner.playerAvatar || raw.playerAvatar || "cat",
    lastSettledAt: safeTime(raw.lastSettledAt, owner.now || Date.now()),
    updatedAt: safeTime(raw.updatedAt, owner.now || Date.now())
  };
}

export function buildingAt(state, q, r) {
  return Object.values(state.buildings).find((building) => building.q === q && building.r === r) || null;
}

export function constructionAt(state, q, r) {
  return Object.values(state.constructionJobs).find((job) => job.q === q && job.r === r) || null;
}

export function isTileOccupied(state, q, r) {
  return Boolean(buildingAt(state, q, r) || constructionAt(state, q, r));
}

export function isReclaimable(state, q, r) {
  const key = axialKey(q, r);
  if (state.tiles[key] || axialDistance({ q, r }) > state.radius || constructionAt(state, q, r)) return false;
  return axialNeighbors(q, r).some((neighbor) => Boolean(state.tiles[axialKey(neighbor.q, neighbor.r)]));
}

function canPlaceBuilding(state, definition, q, r, orientation = 0) {
  const cells = footprintCells({ q, r }, definition.footprint, orientation);
  return cells.every((cell) => state.tiles[axialKey(cell.q, cell.r)] && !isTileOccupied(state, cell.q, cell.r));
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

export function startBuilding(state, { buildingId, q, r, orientation = 0, workerId = "cat", playerAvatar = "cat", now = Date.now() } = {}) {
  const definition = BUILDING_CATALOG[buildingId];
  if (!definition?.buildable) return { ok: false, state, error: "這項設施尚未開放建造" };
  if (!canPlaceBuilding(state, definition, q, r, orientation)) return { ok: false, state, error: "這個位置放不下該設施" };
  if (workerBusy(state, workerId)) return { ok: false, state, error: "這位伙伴已經在忙，請另外聘一位伙伴" };
  const workerHireCost = initialWorkerHireCost(workerId, playerAvatar, definition.costCoins);
  const next = clone(state);
  const job = {
    ...baseJob({ kind: "building", q, r, costCoins: definition.costCoins, durationSeconds: definition.durationSeconds, workerId, workTags: definition.workTags, now }),
    buildingId,
    workerHireCost,
    orientation: safeInt(orientation) % 6
  };
  next.constructionJobs[job.id] = job;
  next.updatedAt = now;
  return { ok: true, state: next, costCoins: definition.costCoins + workerHireCost, workerHireCost, job };
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

export function settleIsland(state, now = Date.now()) {
  const next = clone(state);
  const completed = [];
  let changed = false;

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
        completedAt: job.readyAt
      };
      next.buildings[building.id] = building;
      const definition = BUILDING_CATALOG[building.buildingId];
      if (definition.defaultRecipeId || definition.recipeIds?.length) next.facilities[building.id] = createFacility(building, job.readyAt);
      completed.push({ kind: "building", name: definition.name, q: job.q, r: job.r });
    }
    delete next.constructionJobs[jobId];
    changed = true;
  });

  Object.values(next.facilities).forEach((facility) => {
    const recipe = RECIPE_CATALOG[facility.recipeId];
    if (recipe?.kind !== "source" || facility.state !== "running" || safeTime(facility.readyAt) > now) return;
    facility.state = "ready";
    facility.readyOutput = clone(recipe.outputs);
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
      facility.updatedAt = now;
      completed.push({ kind: "processing", name: RECIPE_CATALOG[job.recipeId]?.name || "加工", buildingInstanceId: job.buildingInstanceId });
    }
    delete next.processingJobs[jobId];
    changed = true;
  });

  if (changed) next.updatedAt = now;
  next.lastSettledAt = now;
  return { state: next, changed, completed };
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
  const next = clone(settled);
  const target = next.facilities[buildingInstanceId];
  const collected = {};
  if (target.state === "ready" && Object.keys(target.readyOutput || {}).length) {
    Object.assign(collected, target.readyOutput);
    addInventory(next.inventory, target.readyOutput);
    const recipe = RECIPE_CATALOG[target.recipeId];
    target.state = "running";
    target.startedAt = now;
    target.readyAt = now + recipe.durationSeconds * 1000;
    target.readyOutput = {};
  }
  if (Object.keys(target.readyOutputs || {}).length) {
    Object.entries(target.readyOutputs).forEach(([itemId, count]) => {
      collected[itemId] = safeInt(collected[itemId]) + safeInt(count);
    });
    addInventory(next.inventory, target.readyOutputs);
    target.readyOutputs = {};
  }
  if (!Object.keys(collected).length) return { ok: false, state: settled, error: "產品還在準備中" };
  target.updatedAt = now;
  next.updatedAt = now;
  return { ok: true, state: next, collected };
}

const hasInputs = (inventory, inputs) => Object.entries(inputs).every(([itemId, count]) => safeInt(inventory[itemId]) >= safeInt(count));

export function startProcessing(state, { buildingInstanceId, recipeId, now = Date.now(), ignoreInputs = false } = {}) {
  const building = state.buildings[buildingInstanceId];
  const definition = BUILDING_CATALOG[building?.buildingId];
  const recipe = RECIPE_CATALOG[recipeId];
  if (!building || !recipe || recipe.kind !== "processor" || recipe.facilityId !== definition?.id) {
    return { ok: false, state, error: "這座設施不能使用該配方" };
  }
  if (!ignoreInputs && !hasInputs(state.inventory, recipe.inputs)) return { ok: false, state, error: "倉庫原料不足" };
  const next = clone(state);
  if (!ignoreInputs) Object.entries(recipe.inputs).forEach(([itemId, count]) => { next.inventory[itemId] -= count; });
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
  if (!item || safeInt(state.inventory[itemId]) < count) return { ok: false, state, error: "倉庫數量不足" };
  const next = clone(state);
  next.inventory[itemId] -= count;
  next.updatedAt = now;
  return { ok: true, state: next, coinsEarned: item.marketCoins * count, sold: { itemId, quantity: count } };
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
  else return { ok: false, state, error: "找不到可馬上完成的工作" };
  const settled = settleIsland(next, now);
  return { ok: true, state: settled.state, completed: settled.completed };
}
