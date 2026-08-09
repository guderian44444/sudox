# 小島建設模式 Handoff

更新日期：2026-08-09
開發分支：`feature/island-building`
目前版次：`v45`／Service Worker `sudox-shell-v45`

## 一句話狀態

小島單人生產與跨玩家物流的完整垂直架構已實作：61 格六角地圖、填海、多格碼頭／機場、伙伴施工、生產加工、無上限倉庫、市場，以及「公開相容設施 → 選物料／方式／數量 → 船機運輸 → 到站付款 → 對方工廠自動加工」流程。正式像素素材仍使用 emoji／CSS fallback；雲端物流 migration 已套用至正式 Supabase 專案。

## 本版完成內容

- 工務小屋已從目錄與建造流程移除。
- 合作碼頭占一格海岸土地與一格海面，會自動嘗試六方向合法朝向；小島機場占三格相連土地。
- 多格建築與施工會完整占用 footprint，不會在每格重複繪製建築，也不能把碼頭海面再拿去填海。
- 陸地和海面相接的每一條六角邊會依鄰接資料顯示白色浪花。
- 相容玩家顯示在地圖邊緣，包含伙伴、玩家名稱與可接收物料；點擊後顯示目的設施、海運／空運、時間、數量、容量、運費與報酬。
- 海運：需合作碼頭，60 分鐘，單次 20 件，無運費。空運：需小島機場，15 分鐘，單次 8 件，每件 2 金幣。
- 確認出貨後立即扣倉庫物料並建立不可重複的 `operation_id`；地圖只依出發／抵達時間播放船或飛機，不逐秒寫資料庫。
- 到站後寄件人報酬只領一次；收件人的相容工廠自動建立加工工作，加工完成後仍由收件人點設施領進無上限倉庫。
- `inventoryUpdatedAt` 讓物流雲端庫存與完整 `SUDOX3` 存檔交接；舊裝置不能把已出貨的庫存覆蓋回去。
- 測試模式若雲端 migration 尚未安裝，會顯示老爸、ANGEL、摩卡島主三位測試島友，可用「馬上完成」驗證運輸與結算。

## 雲端架構

Migration：`supabase/island-logistics-migration.sql`

安裝狀態（2026-08-09）：已套用至 Production project `riradorayjziystoalyj`。Table Editor 已確認三張表與 7 筆預設配方，Database Functions 已確認五個 RPC，並以遊戲 publishable key 實際呼叫 `list_compatible_island_players` 得到 HTTP 200 與相容玩家資料。

新增三張禁止 anon／authenticated 直接讀寫的表：

- `island_network_profiles`：公開姓名、伙伴與設施；庫存留在私有欄位供 RPC 原子扣除。
- `island_recipe_catalog`：伺服器可信的單一原料合作配方、工期與報酬。
- `island_shipments`：出發、抵達、寄件報酬、收件匯入與防重確認事件。

公開 RPC：

- `publish_island_network`
- `list_compatible_island_players`
- `dispatch_island_shipment`
- `get_island_logistics`
- `ack_island_logistics`

所有資產寫入 RPC 都驗證現有 `cloud_saves` 的玩家 UUID 與 4 位 PIN。出貨 RPC 會鎖定寄件人的公開庫存列，在同一交易內驗證設施／配方／容量、扣貨並建立 shipment；同一 `operation_id` 重送只回傳原事件。

### 上線安裝順序

1. 在現有 Supabase 專案 SQL Editor 執行 `supabase/island-logistics-migration.sql`。
2. 重新整理小島，按「重新整理」；有相容工廠的其他玩家才會出現在地圖邊緣。
3. 先用兩個測試玩家各自發布設施，再驗證海運、空運、到站付款、對方加工與重整防重。
4. PUSH／部署前關閉 `ISLAND_TEST_MODE`，再升一次可見版次與 PWA cache。

Publishable key 無法建立資料表或函式；若 migration 未安裝，前端會明確顯示 `跨島物流雲端尚未安裝`，不會假裝已上雲。

## 主要檔案

- `src/island/catalog.js`：schema v2、建築、品項、配方、碼頭與機場 footprint。
- `src/island/model.js`：施工／生產／多格占用／本機時間結算與物流狀態正規化。
- `src/island/logistics.js`：相容設施、運輸方式、報價、防重合併與測試島友。
- `src/island/renderer.js`：海岸浪花、地圖邊緣玩家、物流表單與船機動畫。
- `src/state/island-cloud.js`：五個物流 RPC 的前端 adapter。
- `supabase/island-logistics-migration.sql`：正式雲端資料表與 security-definer RPC。
- `scripts/test-island.mjs`：多格設施、物流扣貨／付款／匯入／防重、SQL 權限與 UI 接點回歸測試。
- `docs/island-building-architecture.md`：產品、資料語意、免費方案負載與素材規格。

## 尚未完成／刻意延後

- 正式像素建築、六方向碼頭、船、飛機與施工四階段 Animated WebP；接點已保留在 `src/island/assets.js`。
- 玩家邀請／封鎖與唯讀拜訪；目前列出 30 天內公開相容設施的玩家。
- 建築移動／拆除、繁榮度、升級與物流取消。
- 長期交易資產應把 4 位家庭 PIN 升級成可撤銷裝置 token；目前 PIN 適合家庭測試，不是公開大型經濟系統的最終身份方案。
- 物流歷史自動清理工作；畫面與查詢目前只保留／讀取近 30 天，正式擴量前應加排程清理已雙方確認的舊事件。

## 驗證與提交規則

- 必跑：`npm.cmd run check`、`git diff --check`。
- 瀏覽器：4173 埠驗證桌面與 390×844 手機，包含玩家節點、表單、白浪、拖曳、滾輪縮放與船機動畫。
- 本工作區原有未追蹤內容不可納入：`preview/`、`public/assets/eel-orange.gif`、`public/assets/eel-white.gif`、`public/assets/friend-mouse-v1.jpg`、`scripts/__pycache__/`。

### PUSH 前硬性檢查

1. 把 `src/island/catalog.js` 的 `ISLAND_TEST_MODE` 改成 `false`。
2. 確認畫面沒有「測試資源 ∞」、測試島友與「馬上完成」。
3. 確認 migration 已套用到線上 Supabase。
4. 重跑完整檢查並升版 Service Worker cache。
