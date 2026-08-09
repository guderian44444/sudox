# 小島建設模式 Handoff

更新日期：2026-08-09
開發分支：`feature/island-building`
分支起點：`f10946a`（建立分支時的 `main`）
目前版次：`v40`／Service Worker `sudox-shell-v40`

## 一句話狀態

可操作的 Foundation 已完成：玩家可從數獨主畫面進入 61 格六角小島，使用共用金幣填海與建設、雇用伙伴縮短真實工期、收成／加工產品、保存到無上限倉庫並在市場出售；正式美術與跨玩家物流尚未實作。

## 已完成

- 主畫面桌機／手機皆有「小島」入口，可回到原本數獨局且保留 session。
- 新玩家從半徑 1 的 7 格小島開始，完整地圖半徑 4，共 61 格。
- 初始設施：島主小屋、無上限倉庫；首次進入一次性增加 100 金幣開發金。
- 填海造陸：必須與現有土地相鄰，費用會隨已填格數提高。
- 建築：菜園、市場、玉米田、牧場、食品工廠、花園、工務小屋、遊樂場。
- 施工：畫面顯示半成品、工作伙伴與倒數；最多 3 位伙伴，增加伙伴會依「剩餘工作量」重算較早的 `readyAt`。
- 時間：沒有每秒寫入資料庫；只保存 `startedAt`／`readyAt`，進入、操作、恢復前景或倒數到期時結算。
- 生產：菜園與玉米田成熟後停在可領取；點擊收成後進倉庫並開始下一批。
- 加工：牧場消耗玉米產牛奶，食品工廠消耗牛奶產乳製品箱；同一工廠允許多個加工工作平行存在，完工品累積等待領取。
- 市場：倉庫物品可賣 1 個或全賣，立即換成共用 SUDOX 金幣。
- 存檔：小島放在 `progress.island`，會跟現有 `SUDOX3` 匯出碼與雲端完整存檔一起同步，不放進數獨 session。
- PWA：新增小島模組與 CSS 到 app shell，cache 已升版。
- Windows 本機啟動：直接開 `index.html` 會顯示說明；雙擊根目錄 `Start_SUDOX.cmd` 會啟動 4173 伺服器並開啟遊戲。
- 素材：沒有正式圖時自動顯示 emoji／CSS 簡圖；正式 WebP 只要放到 `public/assets/island/v1/` 並登錄 manifest。

## 重要資料語意

- `progress.coins` 是唯一共用錢包，小島不另建第二個餘額。
- `mergeProgressHighWater(primary, secondary)` 不再對金幣取最大值；金幣與小島使用較新的主要存檔，只有樓層、完成局數、星星、等級等生命週期統計取高水位。這是為了避免另一台裝置把已花掉的建設金幣復活。
- `progress.island.inventory` 只保存各品項數量，倉庫無上限不代表每件物品各占一筆資料。
- `constructionJobs` 與 `processingJobs` 都以絕對毫秒時間保存；畫面倒數只供顯示，完成判定永遠以 `readyAt <= now` 為準。
- Source 設施用 `facilities[].readyOutput` 保存一批待領收成；Processor 用 `readyOutputs` 合併多批待領結果。

## 主要檔案

- `src/island/catalog.js`：建築、品項、配方、費用與工期。
- `src/island/hex.js`：axial 六角座標、鄰接、旋轉、占地與像素位置。
- `src/island/model.js`：狀態建立／正規化、施工、時間結算、生產、領取與市場規則。
- `src/island/renderer.js`：可存取 DOM 地圖、選取面板、倉庫與操作按鈕。
- `src/island/island.css`：像素感簡圖、伙伴施工動畫與手機版。
- `src/island/assets.js`：正式素材 manifest 與 fallback 接點。
- `scripts/test-island.mjs`：地圖、填海、施工加速、存檔、生產鏈與市場回歸測試。
- `docs/island-building-architecture.md`：完整產品、經濟、資料庫與物流規劃。
- `docs/sudox-ai-art-style-guide.md`：供其他 AI 生成素材的明確風格標準。

## 素材接入方式

1. 按 `docs/sudox-ai-art-style-guide.md` 生成透明背景 WebP。
2. 放入 `public/assets/island/v1/` 對應子目錄。
3. 在 `src/island/assets.js` 的 `ISLAND_ASSET_MANIFEST` 加一行，例如：

```js
"buildings/garden": "buildings/garden/complete.webp"
```

Renderer 會自動以圖片取代 emoji，不需要改遊戲規則。詳細尺寸與動畫幀數見 `public/assets/island/v1/README.md`。

## 尚未完成／刻意延後

- 碼頭、機場、選擇其他玩家、運輸時間與對方工廠自動加工。
- Supabase 的島嶼正規化資料表、交易防重 RPC、RLS 與物流保留政策。
- 多格建築的完整占地／旋轉操作；目前可建設設施都是單格，碼頭與機場雖有 footprint 定義但保持鎖定。
- 拖曳地圖、建築移動／拆除、繁榮度、裝飾效果、設施升級與額外施工欄位。
- 正式像素建築的地基／半成品／接近完工／完工四階段動畫。
- 伺服器可信時間；Foundation 使用裝置現在時間，因此玩家手動調整手機時鐘仍可能影響本機完工判定。社交物流必須改用伺服器時間。
- 完整跨裝置併發編輯；現在採「較新完整存檔勝出＋生命週期統計高水位」，不適合兩台裝置同時建設。

## 驗證紀錄

2026-08-09 已完成：

- `npm.cmd run check`：通過（核心規則＋小島 Foundation 測試）。
- `git diff --check`：交付前應再次執行。
- 本機 `http://127.0.0.1:4173/`：可進入小島、首次開發金入帳、興建菜園、雇用狗伙伴後金幣扣除且工期從 20 分縮短至約 14 分。
- 重新載入後施工與金幣仍存在。
- 390×844 手機 viewport：61 格地圖、倉庫與控制面板存在，頁面無橫向溢出，console 無 error／warning。

## 下一位開發者建議順序

1. 先補多格 footprint 的占用、預覽與旋轉，再開放碼頭／機場建造。
2. 依架構書建立 Supabase migration、RLS 與 idempotent RPC；物流與錢包異動不能只信任前端。
3. 完成 `shipment -> arrival payout -> receiver processing job` 狀態機與 30 天物流保留清理。
4. 依 AI 美術標準逐項接入正式 WebP，先從地形、施工四階段、菜園／玉米田／牧場／工廠開始。
5. 補 server-time offset、跨裝置 revision／衝突提示，再開放線上合作測試。

## Git 注意事項

本工作區原本就有以下未追蹤內容，本分支不可誤納入：`preview/`、`public/assets/eel-orange.gif`、`public/assets/eel-white.gif`、`public/assets/friend-mouse-v1.jpg`、`scripts/__pycache__/`。提交時只 stage 小島功能、文件，以及本次明確修改的既有檔案。
