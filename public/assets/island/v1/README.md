# SUDOX 小島素材接點（v1）

目前可操作版本會用 emoji／CSS 代替尚未完成的像素素材。不要只依本資料夾猜命名或尺寸，權威文件為：

- `docs/sudox-ai-art-style-guide.md`：SUDOX Buddy & Island Style v1、AI prompt、negative prompt 與視覺驗收。
- `docs/island-asset-integration-guide.md`：已接通／已預留／需擴充 renderer 的素材類型、尺寸、anchor、sidecar JSON 與接入流程。

最短接入流程：

1. 從 `src/island/catalog.js` 或 `npm.cmd run check:island-assets -- --list` 取得 assetKey。
2. 產生透明 WebP 與同名 sidecar JSON，放入本版本目錄。
3. 只有「已接通」的 key 才能直接加到 `src/island/assets.js` 的 `ISLAND_ASSET_MANIFEST`；產品、地形、載具與專用動畫需依接入指南同步修改 renderer。
4. 執行 `npm.cmd run check:island-assets`、`npm.cmd run check`、`git diff --check`，再用 4173 的桌面與 390×844 手機畫面驗收。

單格建築使用 192×192 RGBA 靜態 WebP；伙伴工作循環使用 220×220 RGBA Animated WebP。建築施工本體優先用三張靜態階段圖搭配共用 FX，不為每棟建築製作長動畫。
