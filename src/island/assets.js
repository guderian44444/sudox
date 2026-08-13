/**
 * Runtime art hook.
 * Add a key -> relative WebP path here when final art is ready. The renderer
 * automatically swaps the placeholder symbol for the image without changing
 * construction, production, or map code.
 */
export const ISLAND_ASSET_MANIFEST = Object.freeze({
  "buildings/garden": "buildings/garden/complete.webp",
  "buildings/island-home-level-1": "buildings/island-home-level-1/complete.webp",
  "buildings/market": "buildings/market/complete.webp",
  "buildings/dock": "buildings/dock/complete.webp",
  "buildings/sawmill": "buildings/sawmill/complete.webp",
  "buildings/lighthouse": "buildings/lighthouse/complete.webp",
  "buildings/airport": "buildings/airport/complete.webp",
  "buildings/corn-field": "buildings/corn-field/complete.webp",
  "buildings/grain-field": "buildings/grain-field/complete.webp",
  "buildings/paddy": "buildings/paddy/complete.webp",
  "buildings/tea-garden": "buildings/tea-garden/complete.webp",
  "buildings/vineyard": "buildings/vineyard/complete.webp",
  "buildings/sugarcane-field": "buildings/sugarcane-field/complete.webp",
  "buildings/orchard": "buildings/orchard/complete.webp",
  "buildings/apiary": "buildings/apiary/complete.webp",
  "buildings/ranch": "buildings/ranch/complete.webp",
  "buildings/food-factory": "buildings/food-factory/complete.webp",
  "buildings/roastery": "buildings/roastery/complete.webp",
  "buildings/cafe": "buildings/cafe/complete.webp",
  "buildings/textile-workshop": "buildings/textile-workshop/complete.webp",
  "buildings/bakery": "buildings/bakery/complete.webp",
  "buildings/mill": "buildings/mill/complete.webp",
  "buildings/rice-kitchen": "buildings/rice-kitchen/complete.webp",
  "buildings/tree-nursery": "buildings/tree-nursery/complete.webp",
  "buildings/forest": "buildings/forest/complete.webp",
  "buildings/shipyard": "buildings/shipyard/complete.webp",
  "buildings/mine": "buildings/mine/complete.webp",
  "buildings/smelter": "buildings/smelter/complete.webp",
  "buildings/aircraft-workshop": "buildings/aircraft-workshop/complete.webp",
  "buildings/juice-stand": "buildings/juice-stand/complete.webp",
  "buildings/sugar-mill": "buildings/sugar-mill/complete.webp",
  "buildings/tea-house": "buildings/tea-house/complete.webp",
  "buildings/ice-cream-shop": "buildings/ice-cream-shop/complete.webp",
  "buildings/flower-garden": "buildings/flower-garden/complete.webp",
  "buildings/pond": "buildings/pond/complete.webp",
  "buildings/playground": "buildings/playground/complete.webp",
  "buildings/picnic-park": "buildings/picnic-park/complete.webp",
  "buildings/observation-deck": "buildings/observation-deck/complete.webp",
  "buildings/ferris-wheel": "buildings/ferris-wheel/complete.webp",
  "buildings/hot-spring": "buildings/hot-spring/complete.webp",
  "buildings/island-home-level-2": "buildings/island-home-level-2/complete.webp",
  "buildings/island-home-level-3": "buildings/island-home-level-3/complete.webp",
  "buildings/island-home-level-4": "buildings/island-home-level-4/complete.webp",
  "buildings/island-home-level-5": "buildings/island-home-level-5/complete.webp",
  "items/vegetable": "items/vegetable/complete.webp",
  "items/carrot": "items/carrot/complete.webp",
  "items/tomato": "items/tomato/complete.webp",
  "items/strawberry": "items/strawberry/complete.webp",
  "items/pumpkin": "items/pumpkin/complete.webp",
  "items/potato": "items/potato/complete.webp",
  "items/corn": "items/corn/complete.webp",
  "items/wheat": "items/wheat/complete.webp",
  "items/flour": "items/flour/complete.webp",
  "items/bread": "items/bread/complete.webp",
  "items/rice": "items/rice/complete.webp",
  "items/rice-ball": "items/rice-ball/complete.webp",
  "items/tea-leaf": "items/tea-leaf/complete.webp",
  "items/tea-cup": "items/tea-cup/complete.webp",
  "items/grape": "items/grape/complete.webp",
  "items/grape-juice": "items/grape-juice/complete.webp",
  "items/sugarcane": "items/sugarcane/complete.webp",
  "items/sugar": "items/sugar/complete.webp",
  "items/ice-cream": "items/ice-cream/complete.webp",
  "items/fruit": "items/fruit/complete.webp",
  "items/coffee-bean": "items/coffee-bean/complete.webp",
  "items/roasted-coffee": "items/roasted-coffee/complete.webp",
  "items/coffee-cup": "items/coffee-cup/complete.webp",
  "items/cocoa-bean": "items/cocoa-bean/complete.webp",
  "items/chocolate": "items/chocolate/complete.webp",
  "items/milk": "items/milk/complete.webp",
  "items/egg": "items/egg/complete.webp",
  "items/wool": "items/wool/complete.webp",
  "items/fabric": "items/fabric/complete.webp",
  "items/honey": "items/honey/complete.webp",
  "items/jam": "items/jam/complete.webp",
  "items/cake": "items/cake/complete.webp",
  "items/dairy-box": "items/dairy-box/complete.webp",
  "items/sapling": "items/sapling/complete.webp",
  "items/log": "items/log/complete.webp",
  "items/lumber": "items/lumber/complete.webp",
  "items/metal-ore": "items/metal-ore/complete.webp",
  "items/metal-plate": "items/metal-plate/complete.webp",
  "items/boat": "items/boat/complete.webp",
  "items/plane": "items/plane/complete.webp",
  "construction/building": "construction/building/complete.webp",
  "construction/reclaim": "construction/reclaim/complete.webp",
  "construction/homeUpgrade": "construction/home-upgrade/complete.webp",
  "construction/demolition": "construction/demolition/complete.webp",
  "terrain/water": "terrain/water/complete.webp",
  "terrain/reclaimable": "terrain/reclaimable/complete.webp",
  "terrain/grass": "terrain/grass/complete.webp",
  "terrain/reclaimed": "terrain/reclaimed/complete.webp"
});

const assetBase = new URL("../../public/assets/island/v1/", import.meta.url);

export function islandAssetUrl(assetKey) {
  const relativePath = ISLAND_ASSET_MANIFEST[assetKey];
  return relativePath ? new URL(relativePath, assetBase).href : "";
}

export function islandSpriteMarkup({ assetKey = "", fallback = "🏗️", className = "", label = "" } = {}) {
  const url = islandAssetUrl(assetKey);
  if (url) {
    return `<img class="island-sprite ${className}" src="${url}" alt="${label}" draggable="false">`;
  }
  return `<span class="island-sprite island-sprite-placeholder ${className}" data-asset-key="${assetKey}" aria-label="${label}" role="img">${fallback}</span>`;
}

export function islandItemMarkup(item, className = "island-item-icon") {
  if (!item) return "";
  return islandSpriteMarkup({ assetKey: item.assetKey, fallback: item.icon || "📦", className, label: item.name || "物品" });
}

export function islandTerrainUrl(terrain = "water") {
  return islandAssetUrl(`terrain/${terrain}`);
}
