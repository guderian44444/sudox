import {
  BUILDABLE_BUILDINGS,
  BUILDING_CATALOG,
  ITEM_CATALOG,
  RECIPE_CATALOG,
  reclamationQuote,
  recipeInputsLabel,
  recipeOutputsLabel
} from "./catalog.js";
import { islandSpriteMarkup } from "./assets.js";
import { axialKey, axialToPixel, hexRange, mapPixelBounds } from "./hex.js";
import { buildingAt, constructionAt, helperQuote, isReclaimable } from "./model.js";

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

const countdownMarkup = (readyAt, now) => {
  if (!readyAt) return "";
  return `<time class="island-countdown" data-island-ready-at="${readyAt}">${formatIslandDuration((readyAt - now) / 1000)}</time>`;
};

const outputMarkup = (items = {}) => Object.entries(items).map(([itemId, count]) => {
  const item = ITEM_CATALOG[itemId];
  return item ? `${item.icon} ${item.name} ×${count}` : "";
}).filter(Boolean).join("、");

function workerMarkup(workerIds = []) {
  return `<span class="island-workers" aria-label="施工伙伴">${workerIds.map((id, index) => `
    <img src="${friendAssetUrl(id)}" alt="${escapeHtml(id)}" style="--worker-index:${index}" draggable="false">`).join("")}</span>`;
}

function mapCellMarkup(state, cell, selectedKey, bounds, now) {
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
    content += countdownMarkup(job.readyAt, now);
  }
  return `<button class="${classes}" style="${style}" data-island-cell="${key}" aria-label="${escapeHtml(label)}">${content}</button>`;
}

function constructionPanel(job, coins, helpers, now) {
  const definition = job.kind === "building" ? BUILDING_CATALOG[job.buildingId] : null;
  const helperCost = helperQuote(job);
  return `<div class="island-selection-card">
    <p class="island-panel-kicker">施工進行中</p>
    <h3>${job.kind === "reclaim" ? "🌊 填海造陸" : `${definition?.icon || "🏗️"} ${escapeHtml(definition?.name || "建造設施")}`}</h3>
    <p>由 ${job.workerIds.length} 位伙伴合作，離開遊戲後時間也會照常計算。</p>
    <div class="island-time-row"><span>預計完成</span>${countdownMarkup(job.readyAt, now)}</div>
    ${helperCost ? `<div class="island-helper-box"><strong>雇用伙伴加速</strong><small>下一位伙伴需要 🪙 ${helperCost}</small><div>${helpers.length ? helpers.slice(0, 6).map((helper) => `
      <button data-island-hire="${escapeHtml(job.id)}" data-island-helper="${escapeHtml(helper.id)}" ${coins < helperCost ? "disabled" : ""}><img src="${friendAssetUrl(helper.id)}" alt=""><span>${escapeHtml(helper.name)}</span></button>`).join("") : `<em>伙伴目前都在忙</em>`}</div></div>` : `<p class="island-done-note">已達 3 位施工伙伴的加速上限。</p>`}
  </div>`;
}

function emptyLandPanel(state, q, r, coins) {
  return `<div class="island-selection-card">
    <p class="island-panel-kicker">可建設土地・座標 ${q},${r}</p>
    <h3>選擇要興建的設施</h3>
    <div class="island-build-grid">${BUILDABLE_BUILDINGS.map((building) => `
      <button data-island-build="${building.id}" ${coins < building.costCoins ? "disabled" : ""}>
        ${islandSpriteMarkup({ assetKey: building.assetKey, fallback: building.icon, className: "island-catalog-sprite", label: building.name })}
        <span><strong>${building.name}</strong><small>🪙 ${building.costCoins}・${formatIslandDuration(building.durationSeconds)}</small></span>
      </button>`).join("")}</div>
  </div>`;
}

function sourcePanel(building, facility, now) {
  const definition = BUILDING_CATALOG[building.buildingId];
  const recipe = RECIPE_CATALOG[facility?.recipeId];
  if (!recipe) return "";
  const ready = facility.state === "ready";
  return `<div class="island-facility-box">
    <strong>${ready ? "收成完成" : "正在生長"}</strong>
    <small>${ready ? outputMarkup(facility.readyOutput) : `產出 ${recipeOutputsLabel(recipe)}`}</small>
    ${ready ? `<button class="island-primary" data-island-collect="${building.id}">收成到倉庫</button>` : countdownMarkup(facility.readyAt, now)}
  </div>`;
}

function processorPanel(state, building, facility, now) {
  const definition = BUILDING_CATALOG[building.buildingId];
  const jobs = Object.values(state.processingJobs).filter((job) => job.buildingInstanceId === building.id);
  const readyOutputs = facility?.readyOutputs || {};
  const hasReady = Object.values(readyOutputs).some((count) => count > 0);
  return `<div class="island-facility-box">
    ${hasReady ? `<strong>已完成：${outputMarkup(readyOutputs)}</strong><button class="island-primary" data-island-collect="${building.id}">領取到倉庫</button>` : `<small>目前沒有待領產品</small>`}
    ${jobs.length ? `<div class="island-job-list">${jobs.map((job) => `<span>${escapeHtml(RECIPE_CATALOG[job.recipeId]?.name || "加工中")} ${countdownMarkup(job.readyAt, now)}</span>`).join("")}</div>` : ""}
    <div class="island-recipe-list">${(definition.recipeIds || []).map((recipeId) => {
      const recipe = RECIPE_CATALOG[recipeId];
      const enough = Object.entries(recipe.inputs).every(([itemId, count]) => (state.inventory[itemId] || 0) >= count);
      return `<button data-island-process="${recipeId}" data-island-building="${building.id}" ${enough ? "" : "disabled"}><strong>${recipe.name}</strong><small>${recipeInputsLabel(recipe)} → ${recipeOutputsLabel(recipe)}・${formatIslandDuration(recipe.durationSeconds)}</small></button>`;
    }).join("")}</div>
  </div>`;
}

function marketPanel(state) {
  const available = Object.entries(state.inventory).filter(([, count]) => count > 0);
  return `<div class="island-market-list">${available.length ? available.map(([itemId, count]) => {
    const item = ITEM_CATALOG[itemId];
    return `<div><span>${item.icon} ${item.name} ×${count}</span><span><button data-island-sell="${itemId}" data-island-quantity="1">賣 1・🪙${item.marketCoins}</button><button data-island-sell="${itemId}" data-island-quantity="${count}">全賣・🪙${item.marketCoins * count}</button></span></div>`;
  }).join("") : `<p>倉庫目前沒有可販售的產品。</p>`}</div>`;
}

function buildingPanel(state, building, now) {
  const definition = BUILDING_CATALOG[building.buildingId];
  const facility = state.facilities[building.id];
  return `<div class="island-selection-card">
    <p class="island-panel-kicker">已完成設施</p>
    <h3>${definition.icon} ${definition.name}</h3>
    <p>${definition.description}</p>
    ${definition.category === "source" ? sourcePanel(building, facility, now) : ""}
    ${definition.category === "processor" ? processorPanel(state, building, facility, now) : ""}
    ${definition.category === "market" ? marketPanel(state) : ""}
    ${definition.id === "warehouse" ? `<p class="island-done-note">倉庫不設容量上限，所有收成與加工品都會保存在這裡。</p>` : ""}
  </div>`;
}

function selectedPanel(state, selectedKey, coins, helpers, now) {
  const [q, r] = selectedKey.split(",").map(Number);
  const tile = state.tiles[selectedKey];
  const job = constructionAt(state, q, r);
  const building = buildingAt(state, q, r);
  if (job) return constructionPanel(job, coins, helpers, now);
  if (building) return buildingPanel(state, building, now);
  if (tile) return emptyLandPanel(state, q, r, coins);
  if (isReclaimable(state, q, r)) {
    const quote = reclamationQuote(state.reclaimedCount);
    return `<div class="island-selection-card"><p class="island-panel-kicker">可開發海域・座標 ${q},${r}</p><h3>🌊 填海造陸</h3><p>把這格海域變成永久土地，完工後即可興建設施。</p><button class="island-primary" data-island-reclaim ${coins < quote.costCoins ? "disabled" : ""}>開始填海・🪙 ${quote.costCoins}・${formatIslandDuration(quote.durationSeconds)}</button></div>`;
  }
  return `<div class="island-selection-card"><p class="island-panel-kicker">外海・座標 ${q},${r}</p><h3>尚未能開發</h3><p>先填海到相鄰格，之後就能逐步把小島向外擴張。</p></div>`;
}

function inventoryMarkup(state) {
  return Object.entries(ITEM_CATALOG).map(([itemId, item]) => `<div title="市場單價 ${item.marketCoins} 金幣"><span>${item.icon}</span><strong>${state.inventory[itemId] || 0}</strong><small>${item.name}</small></div>`).join("");
}

export function renderIslandScreen({ state, coins, selectedKey = "0,1", zoom = 1, status = "", helpers = [], now = Date.now(), version = "" }) {
  const cells = hexRange(state.radius);
  const bounds = mapPixelBounds(cells);
  const safeZoom = Math.max(0.65, Math.min(1.25, Number(zoom) || 1));
  return `<main class="island-shell">
    <header class="island-topbar">
      <button class="island-back" id="close-island" aria-label="回到數獨">← <span>回數獨</span></button>
      <div><p>ISLAND BUILDING・FOUNDATION</p><h1>🏝️ ${escapeHtml(state.name)}</h1></div>
      <div class="island-top-actions"><span>🪙 <strong>${coins}</strong></span><button data-island-zoom="out" aria-label="縮小地圖">－</button><button data-island-zoom="in" aria-label="放大地圖">＋</button></div>
    </header>
    <section class="island-workspace">
      <div class="island-map-column">
        <div class="island-map-help"><span>點選土地、建築或海域開始操作</span><small>進入頁面時會依真實時間結算進度</small></div>
        <div class="island-map-viewport">
          <div class="island-map" style="width:${bounds.width}px;height:${bounds.height}px;--island-zoom:${safeZoom}">${cells.map((cell) => mapCellMarkup(state, cell, selectedKey, bounds, now)).join("")}</div>
        </div>
        <div class="island-inventory" aria-label="無上限倉庫">${inventoryMarkup(state)}</div>
      </div>
      <aside class="island-control-panel">
        ${status ? `<p class="island-status" role="status">${escapeHtml(status)}</p>` : ""}
        ${selectedPanel(state, selectedKey, coins, helpers, now)}
        <details class="island-coming-soon"><summary>下一階段接點</summary><p>碼頭、機場、跨玩家物流與正式像素動畫已保留資料與素材接點，本版先不寫入雲端物流資料表。</p></details>
      </aside>
    </section>
    <footer class="island-footer">小島架構版 ${escapeHtml(version)}・資料隨完整 SUDOX 存檔同步</footer>
  </main>`;
}
