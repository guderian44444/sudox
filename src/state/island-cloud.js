import { callRpc } from "./cloud.js";

const timestampMs = (value) => {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

function shipmentFromCloud(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: String(raw.id || ""),
    operationId: String(raw.operation_id || raw.operationId || ""),
    mode: "cloud",
    status: String(raw.status || "in_transit"),
    partnerId: String(raw.partner_id || raw.partnerId || raw.receiver_id || raw.sender_id || ""),
    partnerName: String(raw.partner_name || raw.partnerName || raw.receiver_name || raw.sender_name || "合作小島"),
    partnerAvatar: String(raw.partner_avatar || raw.partnerAvatar || raw.receiver_avatar || raw.sender_avatar || "cat"),
    senderName: String(raw.sender_name || raw.senderName || "島友"),
    facilityInstanceId: String(raw.facility_instance_id || raw.facilityInstanceId || ""),
    buildingId: String(raw.building_id || raw.buildingId || ""),
    recipeId: String(raw.recipe_id || raw.recipeId || ""),
    itemId: String(raw.item_id || raw.itemId || ""),
    inputPerBatch: Number(raw.input_per_batch ?? raw.inputPerBatch) || 1,
    quantity: Number(raw.quantity) || 0,
    methodId: String(raw.method_id || raw.methodId || "boat"),
    rewardCoins: Number(raw.reward_coins ?? raw.rewardCoins) || 0,
    feeCoins: Number(raw.fee_coins ?? raw.feeCoins) || 0,
    departedAt: timestampMs(raw.departed_at || raw.departedAt),
    arrivesAt: timestampMs(raw.arrives_at || raw.arrivesAt),
    processingReadyAt: timestampMs(raw.processing_ready_at || raw.processingReadyAt)
  };
}

function inventoryPayload(raw) {
  return {
    inventory: raw?.inventory && typeof raw.inventory === "object" ? raw.inventory : null,
    inventoryUpdatedAt: timestampMs(raw?.inventory_updated_at || raw?.inventoryUpdatedAt)
  };
}

export async function publishIslandNetwork(snapshot, pin) {
  const result = await callRpc("publish_island_network", {
    p_player_id: snapshot.playerId,
    p_pin: pin,
    p_player_name: snapshot.playerName,
    p_player_avatar: snapshot.playerAvatar,
    p_inventory: snapshot.inventory,
    p_inventory_updated_at: new Date(snapshot.inventoryUpdatedAt).toISOString(),
    p_buildings: snapshot.buildings
  });
  return inventoryPayload(result);
}

export async function listIslandPartners(playerId) {
  const rows = await callRpc("list_compatible_island_players", { p_player_id: playerId });
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: String(row.player_id || row.id || ""),
    name: String(row.player_name || row.name || "島友"),
    avatar: String(row.player_avatar || row.avatar || "cat"),
    updatedAt: timestampMs(row.updated_at || row.updatedAt),
    online: timestampMs(row.updated_at || row.updatedAt) > Date.now() - 15 * 60 * 1000,
    offers: Array.isArray(row.offers) ? row.offers.map((offer) => ({
      id: String(offer.id || ""),
      facilityInstanceId: String(offer.facility_instance_id || offer.facilityInstanceId || ""),
      buildingId: String(offer.building_id || offer.buildingId || ""),
      recipeId: String(offer.recipe_id || offer.recipeId || ""),
      itemId: String(offer.item_id || offer.itemId || ""),
      inputPerBatch: Number(offer.input_per_batch ?? offer.inputPerBatch) || 1,
      outputs: offer.outputs || {},
      processingSeconds: Number(offer.processing_seconds ?? offer.processingSeconds) || 0,
      rewardPerItem: Number(offer.reward_per_item ?? offer.rewardPerItem) || 1
    })) : []
  }));
}

export async function dispatchIslandShipment({ operationId, senderId, pin, receiverId, facilityInstanceId, recipeId, itemId, quantity, methodId }) {
  const result = await callRpc("dispatch_island_shipment", {
    p_operation_id: operationId,
    p_sender_id: senderId,
    p_pin: pin,
    p_receiver_id: receiverId,
    p_facility_instance_id: facilityInstanceId,
    p_recipe_id: recipeId,
    p_item_id: itemId,
    p_quantity: quantity,
    p_method: methodId
  });
  return { shipment: shipmentFromCloud(result?.shipment || result), ...inventoryPayload(result) };
}

export async function getIslandLogistics(playerId, pin) {
  const result = await callRpc("get_island_logistics", { p_player_id: playerId, p_pin: pin }) || {};
  return {
    outgoingShipments: (result.outgoing_shipments || result.outgoingShipments || []).map(shipmentFromCloud).filter(Boolean),
    inboundShipments: (result.inbound_shipments || result.inboundShipments || []).map(shipmentFromCloud).filter(Boolean),
    rewardShipments: (result.reward_shipments || result.rewardShipments || []).map(shipmentFromCloud).filter(Boolean),
    ...inventoryPayload(result)
  };
}

export function acknowledgeIslandLogistics(playerId, pin, inboundIds = [], rewardIds = []) {
  return callRpc("ack_island_logistics", {
    p_player_id: playerId,
    p_pin: pin,
    p_inbound_ids: inboundIds,
    p_reward_ids: rewardIds
  });
}
