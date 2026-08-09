# SUDOX 小島素材接點（v1）

目前可操作版本會用 emoji／CSS 簡圖代替尚未完成的像素素材。

接入正式素材時：

1. 依 `docs/sudox-ai-art-style-guide.md` 產生透明背景 WebP。
2. 放入本目錄下的 `buildings/`、`items/`、`construction/` 等子目錄。
3. 在 `src/island/assets.js` 的 `ISLAND_ASSET_MANIFEST` 加上 `assetKey -> 相對路徑`。
4. 不需要修改地圖、建造、生產或存檔程式。

建議單格建築完工動畫使用 4 至 8 幀 WebP，畫布 192×192 px；靜態圖同畫布、透明背景。實際顯示大小由 CSS 控制。
