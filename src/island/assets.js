/**
 * Runtime art hook.
 * Add a key -> relative WebP path here when final art is ready. The renderer
 * automatically swaps the placeholder symbol for the image without changing
 * construction, production, or map code.
 */
export const ISLAND_ASSET_MANIFEST = Object.freeze({
  // "buildings/garden": "buildings/garden/complete.webp"
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
