import {
  BUILDABLE_BUILDINGS,
  BUILDING_CATEGORIES,
  BUILDING_CATALOG,
  HOME_LEVELS,
  ITEM_CATALOG,
  RECLAMATION_WORK_TAGS,
  RECIPE_CATALOG,
  reclamationQuote,
  recipeInputsLabel,
  recipeOutputsLabel
} from "./catalog.js?v=v55";
import { currentAttractionVisitorIds } from "./attractions.js?v=v55";
import { islandSpriteMarkup } from "./assets.js?v=v55";
import { adjustedConstructionDuration, companionAbility, companionReductionPercent, constructionTeamRate } from "./companions.js?v=v55";
import { FRIEND_ROSTER } from "../game/friends.js?v=v55";
import { axialDistance, axialKey, axialToPixel, footprintCells, HEX_DIRECTIONS, HEX_HEIGHT, HEX_WIDTH, hexRange, mapPixelBounds } from "./hex.js?v=v55";
import { availableTransportMethods, buildingName, LOGISTICS_METHODS, partnerAcceptedItems, partnerLogisticsOffers, shipmentQuote } from "./logistics.js?v=v55";
import { availableInventoryQuantity, buildingAnchorAt, buildingAt, constructionAnchorAt, constructionAt, constructionJobWorkTags, helperQuote, initialWorkerHireCost, islandHomeLevel, islandInventoryCapacity, islandInventoryUsed, isReclaimable } from "./model.js?v=v55";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);

const friendAssetUrl = (id) => new URL(`../../public/assets/friends/${id}.png`, import.meta.url).href;

export function formatIslandDuration(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} 小時 ${remainder} 分` : `${hours} 小時`;
}

const countdownMarkup = (readyAt, now) => readyAt
  ? `<time class="island-countdown" data-island-ready-at="${readyAt}">${formatIslandDuration((readyAt - now) / 1000)}</time>`
  : "";

const outputMarkup = (items = {}) => Object.entries(items).map(([itemId, count]) => {
  const item = ITEM_CATALOG[itemId];
  return item ? `${item.icon} ${item.name} ×${count}` : "";
}).filter(Boolean).join("、");

function workerMarkup(workerIds = []) {
  return `<span class="island-workers" aria-label="施工伙伴">${workerIds.map((id, index) => `
    <img src="${friendAssetUrl(id)}" alt="${escapeHtml(id)}" style="--worker-index:${index}" draggable="false">`).join("")}</span>`;
}

function attractionVisitorsMarkup(building, definition, now) {
  const visitors = currentAttractionVisitorIds(building, definition, now);
  if (!visitors.length) return "";
  return `<span class="island-attraction-visitors" aria-label="正在遊玩的伙伴">${visitors.map((id, index) => `<img src="${friendAssetUrl(id)}" alt="${escapeHtml(FRIEND_ROSTER.find((friend) => friend.id === id)?.name || id)}" style="--visitor-index:${index}" draggable="false">`).join("")}</span>`;
}

function mapCellMarkup(state, cell, selectedKey, bounds, now) {
  const key = axialKey(cell.q, cell.r);
  const position = axialToPixel(cell.q, cell.r);
  const tile = state.tiles[key];
  const occupyingBuilding = buildingAt(state, cell.q, cell.r);
  const building = buildingAnchorAt(state, cell.q, cell.r);
  const occupyingJob = constructionAt(state, cell.q, cell.r);
  const job = constructionAnchorAt(state, cell.q, cell.r);
  const definition = BUILDING_CATALOG[occupyingBuilding?.buildingId];
  const facility = state.facilities[building?.id];
  const reclaimable = !tile && isReclaimable(state, cell.q, cell.r);
  const ready = facility?.state === "ready" || Object.values(facility?.readyOutputs || {}).some((count) => count > 0);
  const activeJobs = building ? Object.values(state.processingJobs).filter((entry) => entry.buildingInstanceId === building.id) : [];
  const classes = [
    "island-hex",
    tile ? "is-land" : "is-water",
    tile?.terrain === "reclaimed" ? "is-reclaimed" : "",
    reclaimable ? "is-reclaimable" : "",
    selectedKey === key ? "is-selected" : "",
    ready ? "is-ready" : "",
    (occupyingBuilding && !building) || (occupyingJob && !job) ? "is-footprint" : ""
  ].filter(Boolean).join(" ");
  const style = `left:${bounds.offsetX + position.x}px;top:${bounds.offsetY + position.y}px`;
  const label = definition?.name || (occupyingJob ? (occupyingJob.kind === "reclaim" ? "填海施工中" : occupyingJob.kind === "demolition" ? "設施拆除中" : `${BUILDING_CATALOG[occupyingJob.buildingId]?.name || "設施"}施工中`) : tile ? "空地" : reclaimable ? "可填海" : "海域");
  let content = tile ? `<span class="island-ground-detail" aria-hidden="true">${tile.terrain === "reclaimed" ? "·" : "✦"}</span>` : `<span class="island-wave" aria-hidden="true">≈</span>`;
  if (tile) content += HEX_DIRECTIONS.map((direction, index) => state.tiles[axialKey(cell.q + direction.q, cell.r + direction.r)] ? "" : `<span class="island-shore-foam dir-${index}" aria-hidden="true"></span>`).join("");
  if (building && definition) {
    const homeLevel = definition.id === "islandHome" ? HOME_LEVELS[Math.max(0, Math.min(HOME_LEVELS.length - 1, Number(building.level || 1) - 1))] : null;
    content += islandSpriteMarkup({ assetKey: homeLevel?.assetKey || definition.assetKey, fallback: homeLevel?.icon || definition.icon, className: "island-building-sprite", label: homeLevel?.name || definition.name });
    content += attractionVisitorsMarkup(building, definition, now);
    if (ready) content += `<span class="island-ready-badge" aria-label="可以領取">!</span>`;
    if (activeJobs.length) content += `<span class="island-job-badge" title="加工批次">${activeJobs.length}</span>`;
  }
  if (job) {
    const fallback = job.kind === "demolition" ? "🧹" : job.kind === "homeUpgrade" ? "🔨" : "🏗️";
    content += islandSpriteMarkup({ assetKey: `construction/${job.kind}`, fallback, className: "island-building-sprite island-under-construction", label: "施工中" });
    content += workerMarkup(job.workerIds);
  }
  return `<button class="${classes}" style="${style}" data-island-cell="${key}" aria-label="${escapeHtml(label)}">${content}</button>`;
}

function partnerSlots(bounds, partners) {
  const slots = [
    { x: -4, y: 34 }, { x: bounds.width - 108, y: 34 },
    { x: -10, y: bounds.height / 2 - 31 }, { x: bounds.width - 102, y: bounds.height / 2 - 31 },
    { x: 4, y: bounds.height - 91 }, { x: bounds.width - 112, y: bounds.height - 91 }
  ];
  return new Map(partners.slice(0, slots.length).map((partner, index) => [partner.id, slots[index]]));
}

function partnerNodesMarkup(partners, selectedPartnerId, bounds) {
  const slots = partnerSlots(bounds, partners);
  return partners.slice(0, 6).map((partner) => {
    const slot = slots.get(partner.id);
    const accepted = partnerAcceptedItems(partner).slice(0, 4);
    return `<button class="island-partner-node ${partner.id === selectedPartnerId ? "selected" : ""}" style="left:${slot.x}px;top:${slot.y}px" data-island-partner="${escapeHtml(partner.id)}" aria-label="與 ${escapeHtml(partner.name)} 合作物流">
      <img src="${friendAssetUrl(partner.avatar)}" alt=""><span><b>${escapeHtml(partner.name)}</b><small>${partner.marketFacilityId ? "🏪 收購全部貨物" : `${accepted.map((itemId) => ITEM_CATALOG[itemId]?.icon || "📦").join(" ")} 可接收`}</small></span><i>${partner.online ? "●" : "○"}</i>
    </button>`;
  }).join("");
}

function transportOrigin(state, methodId, bounds) {
  const method = LOGISTICS_METHODS[methodId];
  const building = Object.values(state.buildings || {}).find((entry) => entry.buildingId === method?.buildingId);
  const definition = BUILDING_CATALOG[building?.buildingId];
  if (!building || !definition) return { point: { x: bounds.width / 2, y: bounds.height / 2 }, cell: null };
  const allCells = footprintCells(building, definition.footprint, building.orientation);
  const waterIndexes = new Set(definition.waterFootprintIndexes || []);
  const originCells = methodId === "boat" ? allCells.filter((_, index) => waterIndexes.has(index)) : allCells;
  const cells = originCells.length ? originCells : allCells;
  const points = cells.map((cell) => axialToPixel(cell.q, cell.r));
  return {
    point: {
      x: bounds.offsetX + points.reduce((sum, point) => sum + point.x, 0) / points.length + HEX_WIDTH / 2,
      y: bounds.offsetY + points.reduce((sum, point) => sum + point.y, 0) / points.length + HEX_HEIGHT / 2
    },
    cell: cells[0] || null
  };
}

const routeCellCenter = (cell, bounds) => {
  const point = axialToPixel(cell.q, cell.r);
  return { x: bounds.offsetX + point.x + HEX_WIDTH / 2, y: bounds.offsetY + point.y + HEX_HEIGHT / 2 };
};

function boatRouteCells(state, start, destination, bounds) {
  if (!start || state.tiles[axialKey(start.q, start.r)]) return [];
  const queue = [start];
  const startKey = axialKey(start.q, start.r);
  const parent = new Map([[startKey, ""]]);
  for (let index = 0; index < queue.length; index += 1) {
    const cell = queue[index];
    HEX_DIRECTIONS.forEach((direction) => {
      const neighbor = { q: cell.q + direction.q, r: cell.r + direction.r };
      const key = axialKey(neighbor.q, neighbor.r);
      if (parent.has(key) || axialDistance(neighbor) > state.radius || state.tiles[key]) return;
      parent.set(key, axialKey(cell.q, cell.r));
      queue.push(neighbor);
    });
  }
  const target = queue.filter((cell) => axialDistance(cell) === state.radius).sort((left, right) => {
    const leftPoint = routeCellCenter(left, bounds);
    const rightPoint = routeCellCenter(right, bounds);
    return Math.hypot(leftPoint.x - destination.x, leftPoint.y - destination.y) - Math.hypot(rightPoint.x - destination.x, rightPoint.y - destination.y);
  })[0];
  if (!target) return [];
  const route = [];
  let key = axialKey(target.q, target.r);
  while (key) {
    const [q, r] = key.split(",").map(Number);
    route.push({ q, r });
    key = parent.get(key) || "";
  }
  return route.reverse();
}

function routePath(points) {
  return points.map((point, index) => `${index ? "L" : "M"} ${Math.round(point.x)} ${Math.round(point.y)}`).join(" ");
}

function transportMarkup(state, partners, bounds, now) {
  const slots = partnerSlots(bounds, partners);
  const shipments = Object.values(state.outgoingShipments || {}).filter((shipment) => shipment.status === "in_transit");
  const routes = shipments.map((shipment, index) => {
    const origin = transportOrigin(state, shipment.methodId, bounds);
    const slot = slots.get(shipment.partnerId) || { x: index % 2 ? bounds.width - 108 : 0, y: 24 + (index % 3) * 100 };
    const destination = { x: slot.x + 54, y: slot.y + 24 };
    const routeCells = shipment.methodId === "boat" ? boatRouteCells(state, origin.cell, destination, bounds) : [];
    const points = shipment.methodId === "boat"
      ? routeCells.map((cell) => routeCellCenter(cell, bounds))
      : [origin.point];
    if (points.length) points.push(destination);
    const path = routePath(points);
    if (!path) return null;
    const icon = LOGISTICS_METHODS[shipment.methodId]?.icon || "📦";
    const duration = Math.max(1, Number(shipment.arrivesAt) - Number(shipment.departedAt));
    const progress = Math.max(0, Math.min(1, (now - Number(shipment.departedAt)) / duration));
    const vehicleStyle = `offset-path:path('${path}');--travel-delay:${(-progress * 4.2 - (index % 4) * .12).toFixed(2)}s`;
    return {
      path: `<path class="island-transport-route is-${escapeHtml(shipment.methodId)}" d="${path}" data-island-route-cells="${routeCells.map((cell) => axialKey(cell.q, cell.r)).join(";")}"></path>`,
      vehicle: `<span class="island-transport is-${escapeHtml(shipment.methodId)}" style="${vehicleStyle}" title="從${escapeHtml(BUILDING_CATALOG[LOGISTICS_METHODS[shipment.methodId]?.buildingId]?.name || "物流設施")}出發・${escapeHtml(shipment.partnerName)}・${ITEM_CATALOG[shipment.itemId]?.name || "貨物"}">${icon}</span>`
    };
  }).filter(Boolean);
  if (!routes.length) return "";
  return `<svg class="island-transport-routes" viewBox="0 0 ${bounds.width} ${bounds.height}" aria-hidden="true">${routes.map((route) => route.path).join("")}</svg>${routes.map((route) => route.vehicle).join("")}`;
}

function abilityLabel(workerId, workTags = []) {
  const ability = companionAbility(workerId);
  const reduction = companionReductionPercent(workerId, workTags);
  return reduction ? `${ability.icon} ${ability.name}・本工程 -${reduction}%` : `${ability.icon} ${ability.name}`;
}

function workerPicker(workers, selectedWorkerId, playerAvatar, workTags = []) {
  return `<div class="island-worker-picker"><strong>指派施工伙伴</strong><small>每位伙伴同時只能做一件事；專長符合工程時會直接縮短工期</small><div>${workers.length ? workers.map((worker) => `
    <button data-island-worker="${escapeHtml(worker.id)}" class="${worker.id === selectedWorkerId ? "selected" : ""}">
      <img src="${friendAssetUrl(worker.id)}" alt=""><span>${escapeHtml(worker.name)}</span><em>${escapeHtml(abilityLabel(worker.id, workTags))}</em><small>${worker.id === playerAvatar ? "自己的伙伴" : "需雇用"}</small>
    </button>`).join("") : `<p>所有伙伴都在工作，請先等一項工程完成。</p>`}</div></div>`;
}

function constructionPanel(job, coins, helpers, now, testMode) {
  const definition = BUILDING_CATALOG[job.buildingId];
  const helperCost = helperQuote(job);
  const workTags = constructionJobWorkTags(job);
  const teamRate = Number(job.teamRate) || constructionTeamRate(job.workerIds, workTags);
  return `<div class="island-selection-card">
    <p class="island-panel-kicker">施工進行中</p>
    <h3>${job.kind === "reclaim" ? "🌊 填海造陸" : job.kind === "demolition" ? `🧹 拆除${escapeHtml(definition?.name || "設施")}` : job.kind === "homeUpgrade" ? `🔨 升級為${escapeHtml(HOME_LEVELS[Number(job.targetLevel || 1) - 1]?.name || "新小屋")}` : `${definition?.icon || "🏗️"} ${escapeHtml(definition?.name || "建造設施")}`}</h3>
    <p>由 ${job.workerIds.length} 位伙伴合作，目前施工速度 ×${teamRate.toFixed(2)}；離開遊戲後時間也會照常計算。</p>
    <div class="island-active-abilities">${job.workerIds.map((workerId) => `<span>${escapeHtml(abilityLabel(workerId, workTags))}</span>`).join("")}</div>
    <div class="island-time-row"><span>預計完成</span>${countdownMarkup(job.readyAt, now)}</div>
    ${testMode ? `<button class="island-test-finish" data-island-finish-kind="construction" data-island-finish-id="${escapeHtml(job.id)}">⚡ 測試：馬上完成</button>` : ""}
    ${helperCost ? `<div class="island-helper-box"><strong>雇用伙伴加速</strong><small>${testMode ? "測試模式不扣資源" : `下一位伙伴需要 🪙 ${helperCost}`}</small><div>${helpers.length ? helpers.map((helper) => `
      <button data-island-hire="${escapeHtml(job.id)}" data-island-helper="${escapeHtml(helper.id)}" ${!testMode && coins < helperCost ? "disabled" : ""}><img src="${friendAssetUrl(helper.id)}" alt=""><span>${escapeHtml(helper.name)}</span><em>${escapeHtml(abilityLabel(helper.id, workTags))}</em></button>`).join("") : `<em>伙伴目前都在忙</em>`}</div></div>` : `<p class="island-done-note">已達 3 位施工伙伴的加速上限。</p>`}
  </div>`;
}

function buildingChoiceMarkup(building, coins, selectedWorkerId, playerAvatar, workerAvailable, testMode, selectedBuildingId = "") {
  const hireCost = initialWorkerHireCost(selectedWorkerId, playerAvatar, building.costCoins);
  const totalCost = building.costCoins + hireCost;
  const adjustedDuration = adjustedConstructionDuration(building.durationSeconds, [selectedWorkerId], building.workTags);
  const ability = companionAbility(selectedWorkerId);
  const reduction = companionReductionPercent(selectedWorkerId, building.workTags);
  return `<button data-island-build="${building.id}" class="${building.id === selectedBuildingId ? "is-selected" : ""}" aria-pressed="${building.id === selectedBuildingId}" ${!workerAvailable || (!testMode && coins < totalCost) ? "disabled" : ""}>
    ${islandSpriteMarkup({ assetKey: building.assetKey, fallback: building.icon, className: "island-catalog-sprite", label: building.name })}
    <span><strong>${building.name}</strong><small>${testMode ? "🧪 資源不扣" : `🪙 ${totalCost}${hireCost ? `（含雇用 ${hireCost}）` : ""}`}・${formatIslandDuration(adjustedDuration)}</small><em>${ability.icon} ${ability.name}${reduction ? ` 生效 -${reduction}%` : "（此工程無加速）"}</em></span>
  </button>`;
}

function categorizedBuildingsMarkup(coins, selectedWorkerId, playerAvatar, workerAvailable, testMode, selectedBuildingId = "") {
  return `<div class="island-build-categories">${BUILDING_CATEGORIES.map((category, index) => {
    const buildings = BUILDABLE_BUILDINGS.filter((building) => building.category === category.id);
    if (!buildings.length) return "";
    return `<details class="island-build-category" ${index === 0 ? "open" : ""}><summary><span>${category.icon} ${category.name}</span><small>${buildings.length} 項</small></summary><div class="island-build-grid">${buildings.map((building) => buildingChoiceMarkup(building, coins, selectedWorkerId, playerAvatar, workerAvailable, testMode, selectedBuildingId)).join("")}</div></details>`;
  }).join("")}</div>`;
}

function buildPreviewMarkup(buildingId, coins, selectedWorkerId, playerAvatar, workerAvailable, testMode) {
  const building = BUILDABLE_BUILDINGS.find((entry) => entry.id === buildingId);
  if (!building) return "";
  const hireCost = initialWorkerHireCost(selectedWorkerId, playerAvatar, building.costCoins);
  const totalCost = building.costCoins + hireCost;
  const adjustedDuration = adjustedConstructionDuration(building.durationSeconds, [selectedWorkerId], building.workTags);
  const chain = productionChainMarkup({ buildingId: building.id }, { recipeId: building.defaultRecipeId || "" });
  return `<section class="island-build-preview" aria-live="polite">
    <p class="island-panel-kicker">已選擇設施</p>
    <h4>${building.icon} ${building.name}</h4>
    <p>${building.description || "完成後可查看這座設施的生產與物流用途。"}</p>
    <div class="island-build-preview-summary"><span>施工成本</span><strong>${testMode ? "🧪 測試資源不扣" : `🪙 ${totalCost}${hireCost ? `（含雇用 ${hireCost}）` : ""}`}</strong><span>預計時間</span><strong>${formatIslandDuration(adjustedDuration)}</strong></div>
    ${chain || `<p class="island-build-no-chain">這座設施完成後會提供島嶼營運功能。</p>`}
    <p class="island-build-confirm-note">先確認施工後，才會消耗資源並讓伙伴開始工作。</p>
    <button class="island-primary" data-island-confirm-build="${building.id}" ${!workerAvailable || (!testMode && coins < totalCost) ? "disabled" : ""}>確認開始施工</button>
  </section>`;
}

function emptyLandPanel(q, r, coins, workers, selectedWorkerId, playerAvatar, testMode, selectedBuildingId = "") {
  const workerAvailable = workers.some((worker) => worker.id === selectedWorkerId);
  return `<div class="island-selection-card">
    <p class="island-panel-kicker">可建設土地・座標 ${q},${r}</p>
    <h3>選擇要興建的設施</h3>
    ${workerPicker(workers, selectedWorkerId, playerAvatar)}
    ${buildPreviewMarkup(selectedBuildingId, coins, selectedWorkerId, playerAvatar, workerAvailable, testMode)}
    ${categorizedBuildingsMarkup(coins, selectedWorkerId, playerAvatar, workerAvailable, testMode, selectedBuildingId)}
  </div>`;
}

function productionRecipeIds(building) {
  const definition = BUILDING_CATALOG[building?.buildingId];
  return [...new Set(definition?.recipeIds || (definition?.defaultRecipeId ? [definition.defaultRecipeId] : []))]
    .filter((recipeId) => RECIPE_CATALOG[recipeId]);
}

function productionRouteName(recipe) {
  const definition = BUILDING_CATALOG[recipe.facilityId];
  return `${definition?.icon || "🏭"} ${definition?.name || recipe.facilityId}`;
}

function productionItemName(itemId) {
  const item = ITEM_CATALOG[itemId];
  return `${item?.icon || "📦"} ${escapeHtml(item?.name || itemId)}`;
}

function productionChainMarkup(building, facility) {
  const definition = BUILDING_CATALOG[building?.buildingId];
  const recipes = productionRecipeIds(building).map((recipeId) => RECIPE_CATALOG[recipeId]);
  if (!definition || !recipes.length) return "";

  const upstream = new Map();
  const downstream = new Map();
  const addRelation = (map, itemId, recipe, count) => {
    if (!map.has(itemId)) map.set(itemId, { counts: new Set() });
    const relation = map.get(itemId);
    relation.counts.add(count);
  };

  recipes.forEach((recipe) => {
    Object.entries(recipe.inputs).forEach(([itemId, count]) => addRelation(upstream, itemId, recipe, count));
    Object.entries(recipe.outputs).forEach(([itemId, count]) => addRelation(downstream, itemId, recipe, count));
  });

  const allRecipes = Object.values(RECIPE_CATALOG);
  const producersFor = (itemId) => allRecipes.filter((recipe) => recipe.outputs[itemId] && recipe.facilityId !== definition.id);
  const consumersFor = (itemId) => allRecipes.filter((recipe) => recipe.inputs[itemId] && recipe.facilityId !== definition.id);
  const quantities = (counts) => [...counts].sort((left, right) => left - right).map((count) => `×${count}`).join(" / ");
  const relationMarkup = (relations, lookup, emptyText) => {
    if (!relations.size) return `<p class="island-production-empty">${emptyText}</p>`;
    return `<div class="island-production-routes">${[...relations.entries()].map(([itemId, relation]) => {
      const routes = lookup(itemId);
      return `<article class="island-production-route" data-island-production-item="${escapeHtml(itemId)}">
        <strong>${productionItemName(itemId)} <em>${quantities(relation.counts)}</em></strong>
        ${routes.length ? `<div>${routes.map((recipe) => `<span><b>${escapeHtml(productionRouteName(recipe))}</b><small>${escapeHtml(recipe.name)}</small></span>`).join("")}</div>` : `<small class="island-production-no-route">${emptyText}</small>`}
      </article>`;
    }).join("")}</div>`;
  };

  const recipeFlow = recipes.map((recipe) => `<li class="${recipe.id === facility?.recipeId ? "is-current" : ""}">
    <span>${Object.keys(recipe.inputs).length ? Object.entries(recipe.inputs).map(([itemId, count]) => `${productionItemName(itemId)} ×${count}`).join(" ＋ ") : "直接採集"}</span>
    <b>→</b>
    <span>${Object.entries(recipe.outputs).map(([itemId, count]) => `${productionItemName(itemId)} ×${count}`).join(" ＋ ")}</span>
    <small>${escapeHtml(recipe.name)}・${formatIslandDuration(recipe.durationSeconds)}</small>
  </li>`).join("");

  return `<section class="island-production-guide" aria-label="生產鏈提示">
    <header class="island-production-guide-header"><div><span class="island-panel-kicker">生產鏈提示</span><h4>前端原料與後端用途</h4></div><span>共 ${recipes.length} 種配方</span></header>
    <ol class="island-production-flow">${recipeFlow}</ol>
    <div class="island-production-branches">
      <section class="island-production-branch is-upstream"><strong>← 前端：原料從哪裡來</strong>${relationMarkup(upstream, producersFor, "這是產業鏈起點，可直接採集。")}</section>
      <section class="island-production-branch is-downstream"><strong>後端：成品可以做什麼 →</strong>${relationMarkup(downstream, consumersFor, "目前沒有後續配方，可販售或送往合作島。")}</section>
    </div>
  </section>`;
}

function sourcePanel(building, facility, now) {
  const recipe = RECIPE_CATALOG[facility?.recipeId];
  if (!recipe) return "";
  const definition = BUILDING_CATALOG[building.buildingId];
  const recipeIds = definition.recipeIds || [definition.defaultRecipeId];
  const ready = facility.state === "ready";
  return `<div class="island-facility-box">
    <strong>${ready ? "收成完成" : "正在生長"}</strong>
    <small>${ready ? outputMarkup(facility.readyOutput) : `產出 ${recipeOutputsLabel(recipe)}`}</small>
    ${ready ? `<button class="island-primary" data-island-collect="${building.id}">收成到小屋倉庫</button>` : countdownMarkup(facility.readyAt, now)}
    <div class="island-source-recipes"><strong>${recipeIds.length > 1 ? "改種／改養" : "生產品項"}</strong><small>${ready ? "先收成才能更換" : "更換品項會重新計算本批時間"}</small>${recipeIds.map((recipeId) => {
      const option = RECIPE_CATALOG[recipeId];
      const current = recipeId === facility.recipeId;
      return `<button data-island-source-recipe="${recipeId}" data-island-building="${building.id}" class="${current ? "selected" : ""}" ${current || ready ? "disabled" : ""}><span><b>${option.name}</b><small>${recipeOutputsLabel(option)}・${formatIslandDuration(option.durationSeconds)}</small></span></button>`;
    }).join("")}</div>
  </div>`;
}

function processorPanel(state, building, facility, now) {
  const definition = BUILDING_CATALOG[building.buildingId];
  const jobs = Object.values(state.processingJobs).filter((job) => job.buildingInstanceId === building.id);
  const readyOutputs = facility?.readyOutputs || {};
  const hasReady = Object.values(readyOutputs).some((count) => count > 0);
  return `<div class="island-facility-box">
    ${hasReady ? `<strong>已完成：${outputMarkup(readyOutputs)}</strong><button class="island-primary" data-island-collect="${building.id}">領取到小屋倉庫</button>` : `<small>目前沒有待領產品</small>`}
    ${jobs.length ? `<div class="island-job-list">${jobs.map((job) => `<span>${escapeHtml(RECIPE_CATALOG[job.recipeId]?.name || "加工中")} ${countdownMarkup(job.readyAt, now)}</span>`).join("")}</div>` : ""}
    <div class="island-recipe-list">${(definition.recipeIds || []).map((recipeId) => {
      const recipe = RECIPE_CATALOG[recipeId];
      const enough = Object.entries(recipe.inputs).every(([itemId, count]) => (state.inventory[itemId] || 0) >= count);
      return `<button data-island-process="${recipeId}" data-island-building="${building.id}" ${enough ? "" : "disabled"}><strong>${recipe.name}</strong><small>${recipeInputsLabel(recipe)} → ${recipeOutputsLabel(recipe)}・${formatIslandDuration(recipe.durationSeconds)}${enough ? "" : "・原料不足"}</small></button>`;
    }).join("")}</div>
  </div>`;
}

function attractionPanel(building, definition, now) {
  const attraction = definition.attraction;
  if (!attraction) return "";
  const visitors = currentAttractionVisitorIds(building, definition, now).map((id) => FRIEND_ROSTER.find((friend) => friend.id === id)?.name || id);
  return `<div class="island-attraction-box"><strong>🎟️ ${escapeHtml(attraction.visitLabel)}</strong><small>每 ${formatIslandDuration(attraction.intervalSeconds)}帶來 🪙 ${attraction.incomeCoins}；離線時間也會結算</small><span>目前訪客：${escapeHtml(visitors.join("、") || "稍後會有伙伴來玩")}</span></div>`;
}

function inventoryMarkup(state) {
  const level = islandHomeLevel(state);
  const used = islandInventoryUsed(state);
  const capacity = islandInventoryCapacity(state);
  const items = Object.entries(ITEM_CATALOG).filter(([itemId, item]) => (state.inventory[itemId] || 0) > 0 || item.vehicleMethodId);
  return `<div class="island-home-inventory">
    <strong>${level.icon} ${level.name}倉庫・${used} / ${capacity}</strong>
    <div class="island-capacity-bar"><i style="width:${Math.min(100, Math.round(used / capacity * 100))}%"></i></div>
    <div class="island-inventory-items">${items.length ? items.map(([itemId, item]) => `
      <article title="市場單價 ${item.marketCoins} 金幣"><span>${item.icon}</span><b>${state.inventory[itemId] || 0}</b><small>${item.name}${item.vehicleMethodId ? `・${availableInventoryQuantity(state, itemId)} 可用` : ""}</small></article>`).join("") : `<p>倉庫目前是空的。</p>`}</div>
  </div>`;
}

function marketPanel(state) {
  const available = Object.entries(state.inventory).filter(([, count]) => count > 0);
  return `<div class="island-market-list">${available.length ? available.map(([itemId, count]) => {
    const item = ITEM_CATALOG[itemId];
    const sellable = availableInventoryQuantity(state, itemId);
    return `<div><span>${item.icon} ${item.name} ×${count}${sellable < count ? `（${count - sellable} 使用中）` : ""}</span><span><button data-island-sell="${itemId}" data-island-quantity="1" ${sellable < 1 ? "disabled" : ""}>賣 1・🪙${item.marketCoins}</button><button data-island-sell="${itemId}" data-island-quantity="${sellable}" ${sellable < 1 ? "disabled" : ""}>可售全賣・🪙${item.marketCoins * sellable}</button></span></div>`;
  }).join("") : `<p>小屋倉庫目前沒有可販售的產品。</p>`}</div>`;
}

function homeUpgradeMarkup(state, coins, workers, selectedWorkerId, playerAvatar, testMode) {
  const current = islandHomeLevel(state);
  const next = HOME_LEVELS[current.level];
  if (!next) return `<div class="island-home-upgrade is-max"><strong>🏰 已達最高等級</strong><small>海島城堡提供 ${current.capacity} 格倉庫容量。</small></div>`;
  const workerAvailable = workers.some((worker) => worker.id === selectedWorkerId);
  const hireCost = initialWorkerHireCost(selectedWorkerId, playerAvatar, next.costCoins);
  const totalCost = next.costCoins + hireCost;
  const duration = adjustedConstructionDuration(next.durationSeconds, [selectedWorkerId], next.workTags);
  return `<div class="island-home-upgrade"><strong>下一級：${next.icon} ${next.name}</strong><small>容量 ${current.capacity} → ${next.capacity}・${formatIslandDuration(duration)}</small>${workerPicker(workers, selectedWorkerId, playerAvatar, next.workTags)}<button class="island-primary" data-island-upgrade-home ${!workerAvailable || (!testMode && coins < totalCost) ? "disabled" : ""}>開始擴建・${testMode ? "🧪 資源不扣" : `🪙 ${totalCost}`}</button></div>`;
}

function demolitionMarkup(building, definition, coins, workers, selectedWorkerId, playerAvatar, testMode) {
  const workerAvailable = workers.some((worker) => worker.id === selectedWorkerId);
  const durationSeconds = Math.min(4 * 60 * 60, Math.max(10 * 60, Math.ceil(definition.durationSeconds * 0.25)));
  const hireCost = initialWorkerHireCost(selectedWorkerId, playerAvatar, Math.max(40, Math.ceil(definition.costCoins * 0.25)));
  const duration = adjustedConstructionDuration(durationSeconds, [selectedWorkerId], definition.workTags);
  return `<details class="island-demolition"><summary>拆除設施</summary><p>拆除也會占用一位伙伴；進行中的加工、待領產品或在途物流必須先處理完。</p>${workerPicker(workers, selectedWorkerId, playerAvatar, definition.workTags)}<button data-island-demolish="${escapeHtml(building.id)}" ${!workerAvailable || (!testMode && coins < hireCost) ? "disabled" : ""}>🧹 開始拆除・${testMode ? "🧪 資源不扣" : `雇用 🪙 ${hireCost}`}・${formatIslandDuration(duration)}</button></details>`;
}

function buildingPanel(state, building, now, testMode, coins, workers, selectedWorkerId, playerAvatar) {
  const definition = BUILDING_CATALOG[building.buildingId];
  const facility = state.facilities[building.id];
  const processor = (definition.recipeIds || []).some((recipeId) => RECIPE_CATALOG[recipeId]?.kind === "processor");
  return `<div class="island-selection-card">
    <p class="island-panel-kicker">已完成設施</p>
    <h3>${definition.icon} ${definition.name}</h3>
    <p>${definition.description}</p>
    ${definition.id === "islandHome" ? inventoryMarkup(state) : ""}
    ${definition.id === "islandHome" ? homeUpgradeMarkup(state, coins, workers, selectedWorkerId, playerAvatar, testMode) : ""}
    ${definition.category === "source" ? sourcePanel(building, facility, now) : ""}
    ${processor ? processorPanel(state, building, facility, now) : ""}
    ${definition.category === "market" ? marketPanel(state) : ""}
    ${attractionPanel(building, definition, now)}
    ${definition.id !== "islandHome" ? demolitionMarkup(building, definition, coins, workers, selectedWorkerId, playerAvatar, testMode) : ""}
    ${productionChainMarkup(building, facility)}
  </div>`;
}

function logisticsPanel(state, partner, networkStatus, networkBusy, testMode) {
  const methods = availableTransportMethods(state);
  const offers = partnerLogisticsOffers(state, partner);
  const offer = offers.find((entry) => availableInventoryQuantity(state, entry.itemId) >= entry.inputPerBatch) || offers[0];
  const method = methods[0];
  const quantity = Math.max(1, offer?.inputPerBatch || 1);
  const quote = shipmentQuote(state, { partner, offer, methodId: method?.id, quantity });
  const accepted = partnerAcceptedItems(partner);
  const processingOffers = offers.filter((entry) => entry.kind !== "market");
  const marketOffers = offers.filter((entry) => entry.kind === "market");
  const offerOption = (entry) => `<option value="${escapeHtml(entry.id)}">${entry.kind === "market" ? `🏪 高價收購・${ITEM_CATALOG[entry.itemId]?.icon || "📦"} ${escapeHtml(ITEM_CATALOG[entry.itemId]?.name || entry.itemId)}・每份 🪙 ${entry.rewardPerItem}` : `${escapeHtml(buildingName(entry.buildingId))}・${ITEM_CATALOG[entry.itemId]?.icon || "📦"} ${escapeHtml(ITEM_CATALOG[entry.itemId]?.name || entry.itemId)} → ${escapeHtml(outputMarkup(entry.outputs))}`}</option>`;
  return `<div class="island-selection-card island-logistics-card">
    <p class="island-panel-kicker">跨島合作設施</p>
    <div class="island-partner-heading"><img src="${friendAssetUrl(partner.avatar)}" alt=""><span><h3>${escapeHtml(partner.name)}</h3><small>${partner.isDemo ? "測試島友" : partner.online ? "最近在線" : "離線也可收貨"}</small></span></div>
    <p>${partner.marketFacilityId ? "🏪 對方市場可高價收購所有貨物；也可把原料送進對方的加工設施。" : `可接收：${accepted.map((itemId) => `${ITEM_CATALOG[itemId]?.icon || "📦"} ${ITEM_CATALOG[itemId]?.name || itemId}`).join("、")}`}</p>
    ${networkStatus ? `<p class="island-network-note">${escapeHtml(networkStatus)}</p>` : ""}
    ${methods.length && offers.length ? `<form class="island-logistics-form" data-island-logistics-form data-island-partner-id="${escapeHtml(partner.id)}">
      <label>送往哪座設施<select name="offer">${processingOffers.length ? `<optgroup label="送到加工設施">${processingOffers.map(offerOption).join("")}</optgroup>` : ""}${marketOffers.length ? `<optgroup label="賣到對方市場（高價）">${marketOffers.map(offerOption).join("")}</optgroup>` : ""}</select></label>
      <label>運送方式<select name="method">${methods.map((entry) => `<option value="${entry.id}">${entry.icon} ${entry.name}・${formatIslandDuration(entry.durationSeconds)}・載量 ${entry.capacity}・載具 ${entry.availableVehicles}/${entry.vehicleCount} 可用</option>`).join("")}</select></label>
      <label>數量<input name="quantity" type="number" inputmode="numeric" min="${quantity}" step="${quantity}" max="${method?.capacity || quantity}" value="${quantity}"></label>
      <div class="island-logistics-stock">小屋倉庫：<strong data-island-logistics-stock>${ITEM_CATALOG[offer.itemId]?.icon || "📦"} ×${availableInventoryQuantity(state, offer.itemId)} 可用</strong></div>
      <div class="island-logistics-quote" data-island-logistics-quote>${quote.ok ? `${quote.method.icon} ${formatIslandDuration(quote.durationSeconds)}後送達・可收 🪙 ${quote.rewardCoins}（本島市場僅 🪙 ${quote.localMarketCoins}）${quote.feeCoins ? `・運費 🪙 ${quote.feeCoins}` : ""}` : escapeHtml(quote.error)}</div>
      <button class="island-primary" type="submit" ${networkBusy ? "disabled" : ""}>${networkBusy ? "物流連線中…" : "確認出貨"}</button>
    </form>` : `<div class="island-logistics-locked"><strong>還缺可用物流</strong><p>${methods.length ? "對方目前沒有可接收的加工設施或市場。" : "先建造合作碼頭或單格小島機場；再由造船廠或飛機工坊製造至少一台載具。"}</p></div>`}
  </div>`;
}

const formatIslandDate = (value) => Number(value) ? new Date(Number(value)).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";

function shipmentPanel(shipment, now) {
  const item = ITEM_CATALOG[shipment.itemId];
  const method = LOGISTICS_METHODS[shipment.methodId];
  const inTransit = shipment.status === "in_transit";
  const total = Math.max(1, Number(shipment.arrivesAt) - Number(shipment.departedAt));
  const progress = inTransit ? Math.max(0, Math.min(100, Math.round((now - Number(shipment.departedAt)) / total * 100))) : 100;
  return `<div class="island-selection-card island-shipment-card">
    <p class="island-panel-kicker">已送出物流明細</p><h3>${method?.icon || "📦"} 前往 ${escapeHtml(shipment.partnerName || "合作小島")}</h3>
    <div class="island-readonly-banner">🔒 已送出的送貨任務只能查看，不能修改或取消。</div>
    <dl><div><dt>貨物</dt><dd>${item?.icon || "📦"} ${escapeHtml(item?.name || shipment.itemId)} ×${shipment.quantity}</dd></div><div><dt>用途</dt><dd>${shipment.buildingId === "market" || shipment.offerKind === "market" ? "賣到對方市場" : `送往${escapeHtml(buildingName(shipment.buildingId))}`}</dd></div><div><dt>方式</dt><dd>${method?.icon || ""} ${method?.name || shipment.methodId}</dd></div><div><dt>出發</dt><dd>${formatIslandDate(shipment.departedAt)}</dd></div><div><dt>抵達</dt><dd>${formatIslandDate(shipment.arrivesAt)}</dd></div><div><dt>報酬</dt><dd>🪙 ${shipment.rewardCoins || 0}</dd></div></dl>
    <div class="island-shipment-progress"><i style="width:${progress}%"></i></div><strong>${inTransit ? `運送中・${progress}%` : "已抵達並結算"}</strong>
  </div>`;
}

function statisticsPanel(state) {
  const stats = state.statistics || {};
  const sum = (field) => Object.values(stats[field] || {}).reduce((total, count) => total + Number(count || 0), 0);
  const visitors = Object.entries(stats.visitors || {}).sort((left, right) => right[1] - left[1]);
  const topVisitor = visitors[0];
  const itemRows = Object.entries(ITEM_CATALOG).filter(([itemId]) => [stats.produced?.[itemId], stats.shipped?.[itemId], stats.sold?.[itemId], stats.partnerSold?.[itemId]].some(Number)).map(([itemId, item]) => `<tr><th>${item.icon} ${item.name}</th><td>${stats.produced?.[itemId] || 0}</td><td>${stats.shipped?.[itemId] || 0}</td><td>${stats.sold?.[itemId] || 0}</td><td>${stats.partnerSold?.[itemId] || 0}</td></tr>`).join("");
  const shipments = Object.values(state.outgoingShipments || {}).sort((left, right) => Number(right.departedAt) - Number(left.departedAt)).slice(0, 8);
  return `<div class="island-selection-card island-statistics">
    <p class="island-panel-kicker">小島統計表</p><h3>📊 營運紀錄</h3>
    <div class="island-stat-cards"><article><b>${sum("produced")}</b><small>生產</small></article><article><b>${sum("shipped")}</b><small>送出</small></article><article><b>${sum("sold") + sum("partnerSold")}</b><small>售出</small></article><article><b>${visitors.reduce((total, entry) => total + Number(entry[1] || 0), 0)}</b><small>遊客</small></article></div>
    <div class="island-stat-summary"><span>本島市場收入 <b>🪙 ${stats.coins?.market || 0}</b></span><span>跨島物流收入 <b>🪙 ${stats.coins?.logistics || 0}</b></span><span>遊憩收入 <b>🪙 ${stats.coins?.attractions || 0}</b></span><span>最常來訪 <b>${topVisitor ? `${escapeHtml(FRIEND_ROSTER.find((friend) => friend.id === topVisitor[0])?.name || topVisitor[0])}・${topVisitor[1]} 次` : "尚無訪客"}</b></span></div>
    <h4>品項流量</h4><div class="island-stat-table"><table><thead><tr><th>品項</th><th>生產</th><th>送出</th><th>本島賣</th><th>跨島賣</th></tr></thead><tbody>${itemRows || `<tr><td colspan="5">尚無生產或交易紀錄</td></tr>`}</tbody></table></div>
    <h4>伙伴來訪排行</h4><div class="island-visitor-ranking">${visitors.length ? visitors.slice(0, 10).map(([id, count], index) => { const friend = FRIEND_ROSTER.find((entry) => entry.id === id); return `<span><b>${index + 1}</b><img src="${friendAssetUrl(id)}" alt=""><em>${escapeHtml(friend?.name || id)}</em><strong>${count} 次</strong></span>`; }).join("") : `<p>遊樂與觀景設施營運後，來訪伙伴會記錄在這裡。</p>`}</div>
    <h4>最近送貨</h4><div class="island-stat-shipments">${shipments.length ? shipments.map((shipment) => `<button data-island-shipment="${escapeHtml(shipment.id)}"><span>${LOGISTICS_METHODS[shipment.methodId]?.icon || "📦"} ${escapeHtml(shipment.partnerName || "合作小島")}</span><small>${ITEM_CATALOG[shipment.itemId]?.icon || "📦"} ×${shipment.quantity}・${shipment.status === "in_transit" ? "運送中" : "已抵達"}</small></button>`).join("") : `<p>尚無送貨紀錄。</p>`}</div>
  </div>`;
}

function selectedPanel({ state, selectedKey, selectedPartner, selectedShipment, showStats, networkStatus, networkBusy, coins, helpers, workers, selectedWorkerId, playerAvatar, selectedBuildingId, now, testMode }) {
  if (showStats) return statisticsPanel(state);
  if (selectedShipment) return shipmentPanel(selectedShipment, now);
  if (selectedPartner) return logisticsPanel(state, selectedPartner, networkStatus, networkBusy, testMode);
  const [q, r] = selectedKey.split(",").map(Number);
  const tile = state.tiles[selectedKey];
  const job = constructionAt(state, q, r);
  const building = buildingAt(state, q, r);
  if (job) return constructionPanel(job, coins, helpers, now, testMode);
  if (building) return buildingPanel(state, building, now, testMode, coins, workers, selectedWorkerId, playerAvatar);
  if (tile) return emptyLandPanel(q, r, coins, workers, selectedWorkerId, playerAvatar, testMode, selectedBuildingId);
  if (isReclaimable(state, q, r)) {
    const quote = reclamationQuote(state.reclaimedCount);
    const workerAvailable = workers.some((worker) => worker.id === selectedWorkerId);
    const hireCost = initialWorkerHireCost(selectedWorkerId, playerAvatar, quote.costCoins);
    const totalCost = quote.costCoins + hireCost;
    const adjustedDuration = adjustedConstructionDuration(quote.durationSeconds, [selectedWorkerId], RECLAMATION_WORK_TAGS);
    const reduction = companionReductionPercent(selectedWorkerId, RECLAMATION_WORK_TAGS);
    return `<div class="island-selection-card"><p class="island-panel-kicker">可開發海域・座標 ${q},${r}</p><h3>🌊 填海造陸</h3><p>把這格海域變成永久土地，完工後即可興建設施。</p>${workerPicker(workers, selectedWorkerId, playerAvatar, RECLAMATION_WORK_TAGS)}<button class="island-primary" data-island-reclaim ${!workerAvailable || (!testMode && coins < totalCost) ? "disabled" : ""}>開始填海・${testMode ? "🧪 資源不扣" : `🪙 ${totalCost}${hireCost ? `（含雇用 ${hireCost}）` : ""}`}・${formatIslandDuration(adjustedDuration)}${reduction ? `（專長 -${reduction}%）` : ""}</button></div>`;
  }
  return `<div class="island-selection-card"><p class="island-panel-kicker">外海・座標 ${q},${r}</p><h3>尚未能開發</h3><p>先填海到相鄰格，之後就能逐步把小島向外擴張。</p></div>`;
}

function activeWork(state) {
  const construction = Object.values(state.constructionJobs).map((job) => ({
    kind: "construction", id: job.id, q: job.q, r: job.r, readyAt: job.readyAt,
    icon: job.kind === "reclaim" ? "🌊" : job.kind === "demolition" ? "🧹" : job.kind === "homeUpgrade" ? "🔨" : BUILDING_CATALOG[job.buildingId]?.icon || "🏗️",
    name: job.kind === "reclaim" ? "填海造陸" : job.kind === "demolition" ? `拆除${BUILDING_CATALOG[job.buildingId]?.name || "設施"}` : job.kind === "homeUpgrade" ? `升級${HOME_LEVELS[Number(job.targetLevel || 1) - 1]?.name || "小屋"}` : BUILDING_CATALOG[job.buildingId]?.name || "建設中",
    workers: job.workerIds || []
  }));
  const processing = Object.values(state.processingJobs).map((job) => {
    const building = state.buildings[job.buildingInstanceId];
    return { kind: "processing", id: job.id, q: building?.q, r: building?.r, readyAt: job.readyAt, icon: "⚙️", name: RECIPE_CATALOG[job.recipeId]?.name || "加工中", workers: [] };
  });
  const sources = Object.values(state.facilities).filter((facility) => facility.state === "running").map((facility) => {
    const building = state.buildings[facility.buildingInstanceId];
    return { kind: "source", id: facility.buildingInstanceId, q: building?.q, r: building?.r, readyAt: facility.readyAt, icon: BUILDING_CATALOG[building?.buildingId]?.icon || "🌱", name: RECIPE_CATALOG[facility.recipeId]?.name || "生產中", workers: [] };
  });
  const shipments = Object.values(state.outgoingShipments || {}).filter((shipment) => shipment.status === "in_transit").map((shipment) => ({
    kind: "shipment", id: shipment.id, readyAt: shipment.arrivesAt,
    icon: LOGISTICS_METHODS[shipment.methodId]?.icon || "📦",
    name: `運往 ${shipment.partnerName || "合作小島"}`,
    workers: [], shipmentId: shipment.id, testFinish: shipment.mode === "demo"
  }));
  return [...construction, ...processing, ...sources, ...shipments]
    .filter((work) => work.kind === "shipment" || (Number.isFinite(work.q) && Number.isFinite(work.r)))
    .sort((left, right) => left.readyAt - right.readyAt);
}

function workBarMarkup(state, now, testMode) {
  const works = activeWork(state);
  return `<section class="island-work-bar" aria-label="目前進行中的工作"><header><strong>目前進行中的工作</strong><small>${works.length} 項</small></header><div>${works.length ? works.map((work) => `
    <article><button class="island-work-main" ${work.shipmentId ? `data-island-shipment="${escapeHtml(work.shipmentId)}"` : `data-island-jump="${work.q},${work.r}"`}><span>${work.icon}</span><b>${escapeHtml(work.name)}</b>${work.workers.length ? workerMarkup(work.workers) : ""}${countdownMarkup(work.readyAt, now)}</button>${testMode && work.kind !== "shipment" || testMode && work.testFinish ? `<button class="island-work-finish" data-island-finish-kind="${work.kind}" data-island-finish-id="${escapeHtml(work.id)}">馬上完成</button>` : ""}</article>`).join("") : `<p>目前沒有進行中的工作。</p>`}</div></section>`;
}

function thankYouLetterMarkup(state) {
  const letter = (state.thankYouLetters || []).find((entry) => !entry.read);
  if (!letter) return "";
  const item = ITEM_CATALOG[letter.itemId];
  return `<div class="island-letter-backdrop" role="presentation"><section class="island-letter" role="dialog" aria-modal="true" aria-label="跨島感謝函">
    <div class="island-letter-postmark"><span>✈ AIR MAIL</span><b>THANK YOU!</b></div>
    <div class="island-letter-address"><small>TO</small><strong>${escapeHtml(state.name)}</strong><small>FROM</small><strong>${escapeHtml(letter.fromName)}</strong></div>
    <img class="island-letter-sender" src="${friendAssetUrl(letter.fromAvatar)}" alt="">
    <p>親愛的島主：<br>貨物平安到達了！謝謝你送來 ${item?.icon || "📦"} <b>${escapeHtml(item?.name || "貨物")} ×${letter.quantity}</b>，大家都很開心。下次也請再來合作喔！</p>
    <footer><span>With love across the sea ♡</span><b>${escapeHtml(letter.fromName)}</b></footer>
    <button data-island-dismiss-letter="${escapeHtml(letter.id)}">收下感謝函</button>
  </section></div>`;
}

export function renderIslandScreen({ state, coins, selectedKey = "0,1", zoom = 0.8, status = "", partners = [], selectedPartnerId = "", selectedShipmentId = "", showStats = false, networkStatus = "", networkBusy = false, helpers = [], workers = [], selectedWorkerId = "", selectedBuildingId = "", playerAvatar = "cat", testMode = false, now = Date.now(), version = "" }) {
  const cells = hexRange(state.radius);
  const bounds = mapPixelBounds(cells);
  const safeZoom = Math.max(0.55, Math.min(1.25, Number(zoom) || 0.8));
  const scaledWidth = Math.ceil(bounds.width * safeZoom);
  const scaledHeight = Math.ceil(bounds.height * safeZoom);
  const selectedPartner = partners.find((partner) => partner.id === selectedPartnerId) || null;
  const selectedShipment = state.outgoingShipments?.[selectedShipmentId] || null;
  return `<main class="island-shell ${testMode ? "is-test-mode" : ""}">
    <header class="island-topbar">
      <button class="island-back" id="close-island" aria-label="回到數獨">← <span>回數獨</span></button>
      <div><p>ISLAND BUILDING・FOUNDATION</p><h1>🏝️ ${escapeHtml(state.name)}</h1></div>
      <div class="island-top-actions">${testMode ? `<span class="island-test-badge">🧪 測試資源 ∞</span>` : `<span>🪙 <strong>${coins}</strong></span>`}</div>
    </header>
    <section class="island-workspace">
      <div class="island-map-column">
        <div class="island-map-help"><span>點選格子操作・按住拖曳地圖・滾輪縮放</span><small>手機可直接按住地圖拖動</small></div>
        <div class="island-map-viewport" data-island-map-viewport>
          <div class="island-map-zoom"><button data-island-zoom="out" aria-label="縮小地圖">－</button><span>${Math.round(safeZoom * 100)}%</span><button data-island-zoom="in" aria-label="放大地圖">＋</button></div>
          <div class="island-map-scale" style="width:${scaledWidth}px;height:${scaledHeight}px">
            <div class="island-map" style="width:${bounds.width}px;height:${bounds.height}px;--island-zoom:${safeZoom}">${cells.map((cell) => mapCellMarkup(state, cell, selectedKey, bounds, now)).join("")}${partnerNodesMarkup(partners, selectedPartnerId, bounds)}${transportMarkup(state, partners, bounds, now)}</div>
          </div>
        </div>
        ${workBarMarkup(state, now, testMode)}
      </div>
      <aside class="island-control-panel">
        ${status ? `<p class="island-status" role="status">${escapeHtml(status)}</p>` : ""}
        <div class="island-network-strip"><span>🌐 ${partners.length ? `${partners.length} 位可合作島友` : "目前沒有相容島友"}</span><div><button data-island-open-stats>📊 統計</button><button data-island-refresh-network ${networkBusy ? "disabled" : ""}>${networkBusy ? "連線中…" : "重新整理"}</button></div></div>
        ${selectedPanel({ state, selectedKey, selectedPartner, selectedShipment, showStats, networkStatus, networkBusy, coins, helpers, workers, selectedWorkerId, selectedBuildingId, playerAvatar, now, testMode })}
      </aside>
    </section>
    ${thankYouLetterMarkup(state)}
    <footer class="island-footer">小島物流版 ${escapeHtml(version)}・${testMode ? "測試模式尚未關閉" : "工程進度與跨島物流皆採雲端交接"}</footer>
  </main>`;
}
