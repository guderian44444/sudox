import {
  BUILDABLE_BUILDINGS,
  BUILDING_CATEGORIES,
  BUILDING_CATALOG,
  ITEM_CATALOG,
  RECLAMATION_WORK_TAGS,
  RECIPE_CATALOG,
  reclamationQuote,
  recipeInputsLabel,
  recipeOutputsLabel
} from "./catalog.js";
import { islandSpriteMarkup } from "./assets.js";
import { adjustedConstructionDuration, companionAbility, companionReductionPercent, constructionTeamRate } from "./companions.js";
import { axialKey, axialToPixel, hexRange, mapPixelBounds } from "./hex.js";
import { buildingAt, constructionAt, constructionJobWorkTags, helperQuote, initialWorkerHireCost, isReclaimable } from "./model.js";

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

function mapCellMarkup(state, cell, selectedKey, bounds) {
  const key = axialKey(cell.q, cell.r);
  const position = axialToPixel(cell.q, cell.r);
  const tile = state.tiles[key];
  const building = buildingAt(state, cell.q, cell.r);
  const job = constructionAt(state, cell.q, cell.r);
  const definition = BUILDING_CATALOG[building?.buildingId];
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
    ready ? "is-ready" : ""
  ].filter(Boolean).join(" ");
  const style = `left:${bounds.offsetX + position.x}px;top:${bounds.offsetY + position.y}px`;
  const label = definition?.name || (job ? (job.kind === "reclaim" ? "填海施工中" : `${BUILDING_CATALOG[job.buildingId]?.name || "設施"}施工中`) : tile ? "空地" : reclaimable ? "可填海" : "海域");
  let content = tile ? `<span class="island-ground-detail" aria-hidden="true">${tile.terrain === "reclaimed" ? "·" : "✦"}</span>` : `<span class="island-wave" aria-hidden="true">≈</span>`;
  if (building && definition) {
    content += islandSpriteMarkup({ assetKey: definition.assetKey, fallback: definition.icon, className: "island-building-sprite", label: definition.name });
    if (ready) content += `<span class="island-ready-badge" aria-label="可以領取">!</span>`;
    if (activeJobs.length) content += `<span class="island-job-badge" title="加工批次">${activeJobs.length}</span>`;
  }
  if (job) {
    content += islandSpriteMarkup({ assetKey: `construction/${job.kind}`, fallback: "🏗️", className: "island-building-sprite island-under-construction", label: "施工中" });
    content += workerMarkup(job.workerIds);
  }
  return `<button class="${classes}" style="${style}" data-island-cell="${key}" aria-label="${escapeHtml(label)}">${content}</button>`;
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
  const definition = job.kind === "building" ? BUILDING_CATALOG[job.buildingId] : null;
  const helperCost = helperQuote(job);
  const workTags = constructionJobWorkTags(job);
  const teamRate = Number(job.teamRate) || constructionTeamRate(job.workerIds, workTags);
  return `<div class="island-selection-card">
    <p class="island-panel-kicker">施工進行中</p>
    <h3>${job.kind === "reclaim" ? "🌊 填海造陸" : `${definition?.icon || "🏗️"} ${escapeHtml(definition?.name || "建造設施")}`}</h3>
    <p>由 ${job.workerIds.length} 位伙伴合作，目前施工速度 ×${teamRate.toFixed(2)}；離開遊戲後時間也會照常計算。</p>
    <div class="island-active-abilities">${job.workerIds.map((workerId) => `<span>${escapeHtml(abilityLabel(workerId, workTags))}</span>`).join("")}</div>
    <div class="island-time-row"><span>預計完成</span>${countdownMarkup(job.readyAt, now)}</div>
    ${testMode ? `<button class="island-test-finish" data-island-finish-kind="construction" data-island-finish-id="${escapeHtml(job.id)}">⚡ 測試：馬上完成</button>` : ""}
    ${helperCost ? `<div class="island-helper-box"><strong>雇用伙伴加速</strong><small>${testMode ? "測試模式不扣資源" : `下一位伙伴需要 🪙 ${helperCost}`}</small><div>${helpers.length ? helpers.map((helper) => `
      <button data-island-hire="${escapeHtml(job.id)}" data-island-helper="${escapeHtml(helper.id)}" ${!testMode && coins < helperCost ? "disabled" : ""}><img src="${friendAssetUrl(helper.id)}" alt=""><span>${escapeHtml(helper.name)}</span><em>${escapeHtml(abilityLabel(helper.id, workTags))}</em></button>`).join("") : `<em>伙伴目前都在忙</em>`}</div></div>` : `<p class="island-done-note">已達 3 位施工伙伴的加速上限。</p>`}
  </div>`;
}

function buildingChoiceMarkup(building, coins, selectedWorkerId, playerAvatar, workerAvailable, testMode) {
  const hireCost = initialWorkerHireCost(selectedWorkerId, playerAvatar, building.costCoins);
  const totalCost = building.costCoins + hireCost;
  const adjustedDuration = adjustedConstructionDuration(building.durationSeconds, [selectedWorkerId], building.workTags);
  const ability = companionAbility(selectedWorkerId);
  const reduction = companionReductionPercent(selectedWorkerId, building.workTags);
  return `<button data-island-build="${building.id}" ${!workerAvailable || (!testMode && coins < totalCost) ? "disabled" : ""}>
    ${islandSpriteMarkup({ assetKey: building.assetKey, fallback: building.icon, className: "island-catalog-sprite", label: building.name })}
    <span><strong>${building.name}</strong><small>${testMode ? "🧪 資源不扣" : `🪙 ${totalCost}${hireCost ? `（含雇用 ${hireCost}）` : ""}`}・${formatIslandDuration(adjustedDuration)}</small><em>${ability.icon} ${ability.name}${reduction ? ` 生效 -${reduction}%` : "（此工程無加速）"}</em></span>
  </button>`;
}

function categorizedBuildingsMarkup(coins, selectedWorkerId, playerAvatar, workerAvailable, testMode) {
  return `<div class="island-build-categories">${BUILDING_CATEGORIES.map((category, index) => {
    const buildings = BUILDABLE_BUILDINGS.filter((building) => building.category === category.id);
    if (!buildings.length) return "";
    return `<details class="island-build-category" ${index === 0 ? "open" : ""}><summary><span>${category.icon} ${category.name}</span><small>${buildings.length} 項</small></summary><div class="island-build-grid">${buildings.map((building) => buildingChoiceMarkup(building, coins, selectedWorkerId, playerAvatar, workerAvailable, testMode)).join("")}</div></details>`;
  }).join("")}</div>`;
}

function emptyLandPanel(q, r, coins, workers, selectedWorkerId, playerAvatar, testMode) {
  const workerAvailable = workers.some((worker) => worker.id === selectedWorkerId);
  return `<div class="island-selection-card">
    <p class="island-panel-kicker">可建設土地・座標 ${q},${r}</p>
    <h3>選擇要興建的設施</h3>
    ${workerPicker(workers, selectedWorkerId, playerAvatar)}
    ${categorizedBuildingsMarkup(coins, selectedWorkerId, playerAvatar, workerAvailable, testMode)}
  </div>`;
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

function processorPanel(state, building, facility, now, testMode) {
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
      return `<button data-island-process="${recipeId}" data-island-building="${building.id}" ${enough || testMode ? "" : "disabled"}><strong>${recipe.name}</strong><small>${testMode ? "🧪 原料不扣・" : `${recipeInputsLabel(recipe)} → `}${recipeOutputsLabel(recipe)}・${formatIslandDuration(recipe.durationSeconds)}</small></button>`;
    }).join("")}</div>
  </div>`;
}

function inventoryMarkup(state) {
  return `<div class="island-home-inventory"><strong>📦 小屋倉庫・容量無上限</strong><div>${Object.entries(ITEM_CATALOG).map(([itemId, item]) => `
    <article title="市場單價 ${item.marketCoins} 金幣"><span>${item.icon}</span><b>${state.inventory[itemId] || 0}</b><small>${item.name}</small></article>`).join("")}</div></div>`;
}

function marketPanel(state) {
  const available = Object.entries(state.inventory).filter(([, count]) => count > 0);
  return `<div class="island-market-list">${available.length ? available.map(([itemId, count]) => {
    const item = ITEM_CATALOG[itemId];
    return `<div><span>${item.icon} ${item.name} ×${count}</span><span><button data-island-sell="${itemId}" data-island-quantity="1">賣 1・🪙${item.marketCoins}</button><button data-island-sell="${itemId}" data-island-quantity="${count}">全賣・🪙${item.marketCoins * count}</button></span></div>`;
  }).join("") : `<p>小屋倉庫目前沒有可販售的產品。</p>`}</div>`;
}

function buildingPanel(state, building, now, testMode) {
  const definition = BUILDING_CATALOG[building.buildingId];
  const facility = state.facilities[building.id];
  return `<div class="island-selection-card">
    <p class="island-panel-kicker">已完成設施</p>
    <h3>${definition.icon} ${definition.name}</h3>
    <p>${definition.description}</p>
    ${definition.id === "islandHome" ? inventoryMarkup(state) : ""}
    ${definition.category === "source" ? sourcePanel(building, facility, now) : ""}
    ${definition.category === "processor" ? processorPanel(state, building, facility, now, testMode) : ""}
    ${definition.category === "market" ? marketPanel(state) : ""}
  </div>`;
}

function selectedPanel({ state, selectedKey, coins, helpers, workers, selectedWorkerId, playerAvatar, now, testMode }) {
  const [q, r] = selectedKey.split(",").map(Number);
  const tile = state.tiles[selectedKey];
  const job = constructionAt(state, q, r);
  const building = buildingAt(state, q, r);
  if (job) return constructionPanel(job, coins, helpers, now, testMode);
  if (building) return buildingPanel(state, building, now, testMode);
  if (tile) return emptyLandPanel(q, r, coins, workers, selectedWorkerId, playerAvatar, testMode);
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
    icon: job.kind === "reclaim" ? "🌊" : BUILDING_CATALOG[job.buildingId]?.icon || "🏗️",
    name: job.kind === "reclaim" ? "填海造陸" : BUILDING_CATALOG[job.buildingId]?.name || "建設中",
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
  return [...construction, ...processing, ...sources].filter((work) => Number.isFinite(work.q) && Number.isFinite(work.r)).sort((left, right) => left.readyAt - right.readyAt);
}

function workBarMarkup(state, now, testMode) {
  const works = activeWork(state);
  return `<section class="island-work-bar" aria-label="目前進行中的工作"><header><strong>目前進行中的工作</strong><small>${works.length} 項</small></header><div>${works.length ? works.map((work) => `
    <article><button class="island-work-main" data-island-jump="${work.q},${work.r}"><span>${work.icon}</span><b>${escapeHtml(work.name)}</b>${work.workers.length ? workerMarkup(work.workers) : ""}${countdownMarkup(work.readyAt, now)}</button>${testMode ? `<button class="island-work-finish" data-island-finish-kind="${work.kind}" data-island-finish-id="${escapeHtml(work.id)}">馬上完成</button>` : ""}</article>`).join("") : `<p>目前沒有進行中的工作。</p>`}</div></section>`;
}

export function renderIslandScreen({ state, coins, selectedKey = "0,1", zoom = 0.8, status = "", helpers = [], workers = [], selectedWorkerId = "", playerAvatar = "cat", testMode = false, now = Date.now(), version = "" }) {
  const cells = hexRange(state.radius);
  const bounds = mapPixelBounds(cells);
  const safeZoom = Math.max(0.55, Math.min(1.25, Number(zoom) || 0.8));
  const scaledWidth = Math.ceil(bounds.width * safeZoom);
  const scaledHeight = Math.ceil(bounds.height * safeZoom);
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
            <div class="island-map" style="width:${bounds.width}px;height:${bounds.height}px;--island-zoom:${safeZoom}">${cells.map((cell) => mapCellMarkup(state, cell, selectedKey, bounds)).join("")}</div>
          </div>
        </div>
        ${workBarMarkup(state, now, testMode)}
      </div>
      <aside class="island-control-panel">
        ${status ? `<p class="island-status" role="status">${escapeHtml(status)}</p>` : ""}
        ${selectedPanel({ state, selectedKey, coins, helpers, workers, selectedWorkerId, playerAvatar, now, testMode })}
        <details class="island-coming-soon"><summary>下一階段接點</summary><p>碼頭、機場、跨玩家物流與正式像素動畫已保留資料與素材接點，本版先不寫入雲端物流資料表。</p></details>
      </aside>
    </section>
    <footer class="island-footer">小島架構版 ${escapeHtml(version)}・${testMode ? "測試模式尚未關閉" : "資料隨完整 SUDOX 存檔同步"}</footer>
  </main>`;
}
