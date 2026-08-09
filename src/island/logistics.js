import { BUILDING_CATALOG, ITEM_CATALOG, RECIPE_CATALOG } from "./catalog.js?v=v49";
import { activeVehicleCount, availableInventoryQuantity } from "./model.js?v=v49";

const clone = (value) => JSON.parse(JSON.stringify(value));
const safeInt = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : fallback;

export const LOGISTICS_METHODS = Object.freeze({
  boat: Object.freeze({ id: "boat", name: "海運", icon: "⛵", buildingId: "dock", vehicleItemId: "boat", durationSeconds: 60 * 60, capacity: 20, feePerItem: 0 }),
  plane: Object.freeze({ id: "plane", name: "空運", icon: "✈️", buildingId: "airport", vehicleItemId: "plane", durationSeconds: 15 * 60, capacity: 8, feePerItem: 2 })
});

export const PARTNER_MARKET_MULTIPLIER = 1.75;

function partnerMarketOffer(partner, itemId) {
  const item = ITEM_CATALOG[itemId];
  if (!partner?.marketFacilityId || !item) return null;
  return {
    id: `${partner.marketFacilityId}:market:${itemId}`,
    kind: "market",
    facilityInstanceId: partner.marketFacilityId,
    buildingId: "market",
    recipeId: `marketSale:${itemId}`,
    itemId,
    inputPerBatch: 1,
    outputs: {},
    processingSeconds: 1,
    rewardPerItem: Math.ceil(item.marketCoins * PARTNER_MARKET_MULTIPLIER)
  };
}

export function partnerLogisticsOffers(state, partner) {
  const processing = Array.isArray(partner?.offers) ? partner.offers : [];
  const market = partner?.marketFacilityId
    ? Object.keys(ITEM_CATALOG).map((itemId) => partnerMarketOffer(partner, itemId)).filter(Boolean)
    : [];
  return [...processing, ...market].sort((left, right) => {
    const leftStock = availableInventoryQuantity(state, left.itemId) > 0 ? 0 : 1;
    const rightStock = availableInventoryQuantity(state, right.itemId) > 0 ? 0 : 1;
    return leftStock - rightStock || Number(left.kind === "market") - Number(right.kind === "market") || left.itemId.localeCompare(right.itemId);
  });
}

function singleInputOffer(recipeId, facilityInstanceId = `demo-${recipeId}`) {
  const recipe = RECIPE_CATALOG[recipeId];
  const entries = Object.entries(recipe?.inputs || {});
  if (recipe?.kind !== "processor" || entries.length !== 1) return null;
  const [itemId, inputPerBatch] = entries[0];
  return {
    id: `${facilityInstanceId}:${recipeId}:${itemId}`,
    facilityInstanceId,
    buildingId: recipe.facilityId,
    recipeId,
    itemId,
    inputPerBatch,
    outputs: clone(recipe.outputs),
    processingSeconds: recipe.durationSeconds,
    rewardPerItem: Math.max(1, Math.ceil((ITEM_CATALOG[itemId]?.marketCoins || 1) * 1.25))
  };
}

const demoPartner = (id, name, avatar, recipeIds) => Object.freeze({
  id,
  name,
  avatar,
  online: false,
  isDemo: true,
  marketFacilityId: `demo-market-${id}`,
  offers: Object.freeze(recipeIds.map((recipeId) => singleInputOffer(recipeId)).filter(Boolean))
});

export const DEMO_ISLAND_PARTNERS = Object.freeze([
  demoPartner("demo-dad", "老爸", "cow", ["milkBatch", "eggBatch"]),
  demoPartner("demo-angel", "ANGEL", "owl", ["dairyBatch", "jamBatch"]),
  demoPartner("demo-moka", "摩卡島主", "monkey", ["roastCoffee", "weaveFabric"])
]);

export function availableTransportMethods(state) {
  const buildingIds = new Set(Object.values(state?.buildings || {}).map((building) => building.buildingId));
  return Object.values(LOGISTICS_METHODS).filter((method) => buildingIds.has(method.buildingId)).map((method) => {
    const vehicleCount = safeInt(state?.inventory?.[method.vehicleItemId]);
    const busyVehicles = activeVehicleCount(state, method.id);
    return { ...method, vehicleCount, busyVehicles, availableVehicles: Math.max(0, vehicleCount - busyVehicles) };
  });
}

export function normalizeIslandPartner(raw) {
  if (!raw || typeof raw !== "object") return null;
  const offers = (Array.isArray(raw.offers) ? raw.offers : []).map((offer) => {
    const recipe = RECIPE_CATALOG[offer?.recipeId];
    const item = ITEM_CATALOG[offer?.itemId];
    if (!recipe || !item || recipe.facilityId !== offer.buildingId) return null;
    const inputPerBatch = safeInt(offer.inputPerBatch);
    if (!inputPerBatch) return null;
    return {
      id: String(offer.id || `${offer.facilityInstanceId}:${recipe.id}:${item.id}`),
      kind: String(offer.kind || (recipe.facilityId === "market" ? "market" : "processing")),
      facilityInstanceId: String(offer.facilityInstanceId || ""),
      buildingId: recipe.facilityId,
      recipeId: recipe.id,
      itemId: item.id,
      inputPerBatch,
      outputs: clone(recipe.outputs),
      processingSeconds: safeInt(offer.processingSeconds, recipe.durationSeconds),
      rewardPerItem: Math.max(1, safeInt(offer.rewardPerItem, Math.ceil(item.marketCoins * 1.25)))
    };
  }).filter(Boolean);
  const marketFacilityId = String(raw.marketFacilityId || raw.market_facility_id || "").slice(0, 100);
  if (!offers.length && !marketFacilityId) return null;
  return {
    id: String(raw.id || raw.playerId || ""),
    name: String(raw.name || raw.playerName || "島友").slice(0, 16),
    avatar: String(raw.avatar || raw.playerAvatar || "cat"),
    updatedAt: Number(raw.updatedAt) || 0,
    online: Boolean(raw.online),
    isDemo: Boolean(raw.isDemo),
    marketFacilityId,
    offers
  };
}

export function networkProfileSnapshot(state, owner = {}) {
  return {
    playerId: owner.playerId || state.playerId,
    playerName: owner.playerName || "島友",
    playerAvatar: owner.playerAvatar || state.playerAvatar || "cat",
    inventory: Object.fromEntries(Object.keys(ITEM_CATALOG).map((itemId) => [itemId, safeInt(state.inventory?.[itemId])])),
    inventoryUpdatedAt: Number(state.inventoryUpdatedAt) || Number(state.updatedAt) || Date.now(),
    buildings: Object.values(state.buildings || {}).map((building) => ({ id: building.id, buildingId: building.buildingId }))
  };
}

export function shipmentQuote(state, { partner, offer, methodId, quantity } = {}) {
  const method = LOGISTICS_METHODS[methodId];
  const count = safeInt(quantity);
  const availableMethod = availableTransportMethods(state).find((entry) => entry.id === methodId);
  if (!partner || !offer || !method || !availableMethod) return { ok: false, error: "請先建造對應的碼頭或機場" };
  if (!availableMethod.vehicleCount) return { ok: false, error: `先在${methodId === "boat" ? "造船廠建造物流船" : "飛機工坊組裝物流飛機"}` };
  if (!availableMethod.availableVehicles) return { ok: false, error: `所有${methodId === "boat" ? "物流船" : "物流飛機"}都在運送中，請等一趟抵達` };
  if (!count || count > method.capacity || count % offer.inputPerBatch !== 0) {
    return { ok: false, error: `數量必須是 ${offer.inputPerBatch} 的倍數，且不可超過 ${method.capacity}` };
  }
  const cargoAvailable = availableInventoryQuantity(state, offer.itemId) - (offer.itemId === method.vehicleItemId ? 1 : 0);
  if (cargoAvailable < count) return { ok: false, error: "小屋倉庫可用的貨物數量不足" };
  return {
    ok: true,
    quantity: count,
    durationSeconds: method.durationSeconds,
    rewardCoins: offer.rewardPerItem * count,
    localMarketCoins: (ITEM_CATALOG[offer.itemId]?.marketCoins || 0) * count,
    feeCoins: method.feePerItem * count,
    method,
    partner,
    offer
  };
}

function shipmentId(prefix = "shipment") {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function recordDispatchedShipment(state, { shipment } = {}) {
  const itemId = shipment?.itemId;
  const quantity = safeInt(shipment?.quantity);
  if (!ITEM_CATALOG[itemId] || !quantity) return { ok: false, state, error: "物流貨物資料不正確" };
  if (shipment?.id && state.outgoingShipments?.[shipment.id]) return { ok: true, state, shipment: state.outgoingShipments[shipment.id], replayed: true };
  if (availableInventoryQuantity(state, itemId) < quantity) return { ok: false, state, error: "小屋倉庫的貨物數量不足" };
  const next = clone(state);
  next.statistics = next.statistics || {};
  next.statistics.shipped = next.statistics.shipped || {};
  next.statistics.partnerSold = next.statistics.partnerSold || {};
  next.inventory[itemId] -= quantity;
  next.statistics.shipped[itemId] = safeInt(next.statistics.shipped[itemId]) + quantity;
  if (shipment.buildingId === "market" || shipment.offerKind === "market") next.statistics.partnerSold[itemId] = safeInt(next.statistics.partnerSold[itemId]) + quantity;
  next.inventoryUpdatedAt = Number(shipment.departedAt) || Date.now();
  next.outgoingShipments = next.outgoingShipments || {};
  next.outgoingShipments[shipment.id] = clone(shipment);
  next.updatedAt = Number(shipment.departedAt) || Date.now();
  return { ok: true, state: next, shipment: next.outgoingShipments[shipment.id] };
}

export function dispatchDemoShipment(state, { partner, offer, methodId, quantity, now = Date.now() } = {}) {
  const quote = shipmentQuote(state, { partner, offer, methodId, quantity });
  if (!quote.ok) return { ...quote, state };
  const id = shipmentId();
  const shipment = {
    id,
    operationId: id,
    mode: "demo",
    status: "in_transit",
    partnerId: partner.id,
    partnerName: partner.name,
    partnerAvatar: partner.avatar,
    facilityInstanceId: offer.facilityInstanceId,
    buildingId: offer.buildingId,
    recipeId: offer.recipeId,
    offerKind: offer.kind || (offer.buildingId === "market" ? "market" : "processing"),
    itemId: offer.itemId,
    quantity: quote.quantity,
    methodId,
    rewardCoins: quote.rewardCoins,
    feeCoins: quote.feeCoins,
    departedAt: now,
    arrivesAt: now + quote.durationSeconds * 1000
  };
  const recorded = recordDispatchedShipment(state, { shipment });
  return recorded.ok ? { ...recorded, costCoins: quote.feeCoins, quote } : recorded;
}

export function mergeCloudLogistics(state, payload = {}, now = Date.now()) {
  const next = clone(state);
  next.outgoingShipments = next.outgoingShipments || {};
  next.importedShipmentIds = Array.isArray(next.importedShipmentIds) ? next.importedShipmentIds : [];
  next.rewardedShipmentIds = Array.isArray(next.rewardedShipmentIds) ? next.rewardedShipmentIds : [];
  const imported = new Set(next.importedShipmentIds);
  const rewarded = new Set(next.rewardedShipmentIds);
  next.statistics = next.statistics || {};
  next.statistics.coins = next.statistics.coins || {};
  next.statistics.coins.logistics = safeInt(next.statistics.coins.logistics);
  next.thankYouLetters = Array.isArray(next.thankYouLetters) ? next.thankYouLetters : [];
  const ackInboundIds = [];
  const ackRewardIds = [];
  let coinsEarned = 0;

  const cloudInventoryTime = Number(payload.inventoryUpdatedAt) || 0;
  if (payload.inventory && cloudInventoryTime > (Number(next.inventoryUpdatedAt) || 0)) {
    next.inventory = Object.fromEntries(Object.keys(ITEM_CATALOG).map((itemId) => [itemId, safeInt(payload.inventory[itemId])]));
    next.inventoryUpdatedAt = cloudInventoryTime;
  }

  (payload.outgoingShipments || []).forEach((shipment) => {
    if (!shipment?.id) return;
    next.outgoingShipments[shipment.id] = { ...(next.outgoingShipments[shipment.id] || {}), ...clone(shipment), mode: "cloud" };
  });

  (payload.rewardShipments || []).forEach((shipment) => {
    if (!shipment?.id) return;
    ackRewardIds.push(shipment.id);
    if (rewarded.has(shipment.id)) return;
    rewarded.add(shipment.id);
    coinsEarned += safeInt(shipment.rewardCoins);
    next.statistics.coins.logistics += safeInt(shipment.rewardCoins);
    if (!next.thankYouLetters.some((letter) => letter.shipmentId === shipment.id)) {
      next.thankYouLetters.push({
        id: `letter-${shipment.id}`,
        shipmentId: shipment.id,
        fromName: shipment.partnerName || "合作島友",
        fromAvatar: shipment.partnerAvatar || "cat",
        itemId: ITEM_CATALOG[shipment.itemId] ? shipment.itemId : "",
        quantity: safeInt(shipment.quantity),
        receivedAt: now,
        read: false
      });
      next.thankYouLetters = next.thankYouLetters.slice(-50);
    }
  });

  (payload.inboundShipments || []).forEach((shipment) => {
    if (!shipment?.id) return;
    if (imported.has(shipment.id)) {
      ackInboundIds.push(shipment.id);
      return;
    }
    if (shipment.buildingId === "market" || String(shipment.recipeId).startsWith("marketSale:")) {
      imported.add(shipment.id);
      ackInboundIds.push(shipment.id);
      return;
    }
    const building = Object.values(next.buildings || {}).find((entry) => entry.id === shipment.facilityInstanceId)
      || Object.values(next.buildings || {}).find((entry) => entry.buildingId === shipment.buildingId);
    const recipe = RECIPE_CATALOG[shipment.recipeId];
    if (!building || !recipe) return;
    const batches = Math.max(1, safeInt(shipment.quantity) / Math.max(1, safeInt(shipment.inputPerBatch, 1)));
    const outputs = Object.fromEntries(Object.entries(recipe.outputs).map(([itemId, count]) => [itemId, safeInt(count) * batches]));
    const jobId = `remote-${shipment.id}`;
    next.processingJobs[jobId] = {
      id: jobId,
      buildingInstanceId: building.id,
      recipeId: recipe.id,
      inputs: { [shipment.itemId]: safeInt(shipment.quantity) },
      outputs,
      startedAt: Number(shipment.arrivesAt) || now,
      readyAt: Number(shipment.processingReadyAt) || now + recipe.durationSeconds * 1000,
      source: "remote",
      shipmentId: shipment.id,
      senderName: shipment.senderName || "島友"
    };
    imported.add(shipment.id);
    ackInboundIds.push(shipment.id);
  });

  next.importedShipmentIds = [...imported].slice(-200);
  next.rewardedShipmentIds = [...rewarded].slice(-200);
  if (coinsEarned || ackInboundIds.length || ackRewardIds.length) next.updatedAt = now;
  return { state: next, coinsEarned, ackInboundIds, ackRewardIds };
}

export function partnerAcceptedItems(partner) {
  return [...new Set((partner?.offers || []).map((offer) => offer.itemId))];
}

export function buildingName(buildingId) {
  return BUILDING_CATALOG[buildingId]?.name || "加工設施";
}
