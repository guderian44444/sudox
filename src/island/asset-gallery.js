import { ISLAND_ASSET_MANIFEST, islandAssetUrl } from "./assets.js?v=v58";
import { BUILDING_CATALOG, HOME_LEVELS, ITEM_CATALOG } from "./catalog.js?v=v58";

const CATEGORY_INFO = Object.freeze({
  buildings: { label: "建築", actualSize: 45 },
  items: { label: "原物料／產品", actualSize: 22 },
  construction: { label: "施工", actualSize: 45 },
  terrain: { label: "地形", actualSize: 58 }
});

const SPECIAL_LABELS = Object.freeze({
  "construction/building": "建築施工",
  "construction/reclaim": "填海施工",
  "construction/homeUpgrade": "小屋升級",
  "construction/demolition": "拆除施工",
  "terrain/water": "海面",
  "terrain/reclaimable": "舊版可填海素材（遊戲目前不顯示）",
  "terrain/grass": "連續草地",
  "terrain/reclaimed": "舊版填海地面（遊戲目前不顯示）"
});

const labelByKey = new Map();
for (const building of Object.values(BUILDING_CATALOG)) labelByKey.set(building.assetKey, building.name);
for (const level of HOME_LEVELS) labelByKey.set(level.assetKey, level.name);
for (const item of Object.values(ITEM_CATALOG)) labelByKey.set(item.assetKey, item.name);
for (const [key, label] of Object.entries(SPECIAL_LABELS)) labelByKey.set(key, label);

const assets = Object.keys(ISLAND_ASSET_MANIFEST).map((key) => {
  const category = key.split("/")[0];
  return {
    key,
    category,
    categoryLabel: CATEGORY_INFO[category].label,
    name: labelByKey.get(key) || key.split("/").at(-1),
    url: islandAssetUrl(key),
    actualSize: CATEGORY_INFO[category].actualSize
  };
});

const gallery = document.querySelector("#asset-gallery");
const filters = document.querySelector("#asset-filters");
const search = document.querySelector("#asset-search");
const status = document.querySelector("#asset-status");
const dialog = document.querySelector("#asset-dialog");
let activeCategory = "all";
let loadedCount = 0;
let failedCount = 0;

function metadataUrl(asset) {
  return asset.url.replace(/\.[a-z0-9]+(?:\?.*)?$/i, ".json");
}

function updateStatus(visibleCount = assets.length) {
  status.textContent = `顯示 ${visibleCount}／${assets.length}・已載入 ${loadedCount}・失敗 ${failedCount}`;
  status.classList.toggle("has-error", failedCount > 0);
}

function filterAssets() {
  const query = search.value.trim().toLocaleLowerCase("zh-Hant");
  let visibleCount = 0;
  for (const card of gallery.querySelectorAll(".asset-card")) {
    const categoryMatches = activeCategory === "all" || card.dataset.category === activeCategory;
    const queryMatches = !query || card.dataset.search.includes(query);
    const visible = categoryMatches && queryMatches;
    card.hidden = !visible;
    if (visible) visibleCount += 1;
  }
  updateStatus(visibleCount);
}

function createFilters() {
  const counts = Object.fromEntries(Object.keys(CATEGORY_INFO).map((category) => [category, assets.filter((asset) => asset.category === category).length]));
  const entries = [["all", "全部", assets.length], ...Object.entries(CATEGORY_INFO).map(([category, info]) => [category, info.label, counts[category]])];
  for (const [category, label, count] of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.category = category;
    button.className = category === "all" ? "selected" : "";
    button.textContent = `${label} ${count}`;
    button.addEventListener("click", () => {
      activeCategory = category;
      filters.querySelectorAll("button").forEach((entry) => entry.classList.toggle("selected", entry === button));
      filterAssets();
    });
    filters.append(button);
  }
}

async function openAsset(asset) {
  const image = dialog.querySelector("img");
  image.src = asset.url;
  image.alt = asset.name;
  dialog.querySelector("h2").textContent = asset.name;
  dialog.querySelector("code").textContent = asset.key;
  dialog.querySelector(".dialog-category").textContent = asset.categoryLabel;
  dialog.querySelector("dl").replaceChildren();
  dialog.querySelector(".dialog-prompt").textContent = "讀取生成規格中…";
  dialog.querySelector(".dialog-negative").textContent = "";
  dialog.showModal();
  try {
    const metadata = await fetch(metadataUrl(asset), { cache: "no-store" }).then((response) => response.json());
    const details = [
      ["尺寸", `${metadata.width} × ${metadata.height}`],
      ["Style ID", metadata.styleId],
      ["更新時間", metadata.generatedAt]
    ];
    const list = dialog.querySelector("dl");
    for (const [term, value] of details) {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = term;
      dd.textContent = value || "—";
      list.append(dt, dd);
    }
    dialog.querySelector(".dialog-prompt").textContent = `Prompt：${metadata.prompt || "—"}`;
    dialog.querySelector(".dialog-negative").textContent = `Avoid：${metadata.negativePrompt || "—"}`;
  } catch {
    dialog.querySelector(".dialog-prompt").textContent = "無法讀取 metadata。";
  }
}

function createCard(asset) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = `asset-card is-${asset.category}`;
  card.dataset.category = asset.category;
  card.dataset.search = `${asset.name} ${asset.key}`.toLocaleLowerCase("zh-Hant");
  card.innerHTML = `
    <span class="asset-large"><img alt="${asset.name}"></span>
    <span class="asset-copy"><b>${asset.name}</b><code>${asset.key}</code></span>
    <span class="asset-actual"><i>遊戲尺寸</i><span style="--actual-size:${asset.actualSize}px"><img alt=""></span><em>${asset.actualSize}px</em></span>`;
  const images = card.querySelectorAll("img");
  images.forEach((image) => { image.src = asset.url; });
  images[0].addEventListener("load", () => { loadedCount += 1; updateStatus(); }, { once: true });
  images[0].addEventListener("error", () => { failedCount += 1; updateStatus(); card.classList.add("failed"); }, { once: true });
  card.addEventListener("click", () => openAsset(asset));
  return card;
}

createFilters();
gallery.append(...assets.map(createCard));
search.addEventListener("input", filterAssets);
dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
updateStatus();
