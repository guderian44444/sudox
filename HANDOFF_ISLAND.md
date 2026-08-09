# 小島建設模式 Handoff

更新日期：2026-08-09
開發分支：`feature/island-building`
目前版次：`v47`／Service Worker `sudox-shell-v47`
狀態：完整垂直架構已實作；正式像素美術待補；測試模式仍開啟，尚未 PUSH。

## 一句話狀態

目前已具備 217 格六角地圖、填海、伙伴施工與拆除、五級島主小屋倉庫、完整生產鏈、遊憩訪客、船機載具、海格尋路、跨玩家加工／市場交易、唯讀出貨明細、到貨感謝函、統計表與 Supabase 事件交接。正式圖像仍由 emoji／CSS fallback 代替，但所有素材接點都已保留。

## v47 已完成

- 地圖半徑由 4 擴為 8，共 217 格；舊存檔進入時直接取得新範圍，既有陸地與建物不移位。
- 初始島仍是半徑 1 的 7 格；只能填造相鄰海格，不會產生孤島。
- 島主小屋就是倉庫，不另占格；共有 5 級：島主小屋、擴建小屋、海島莊園、島主宮殿、海島城堡。
- 五級容量依序為 80／180／360／720／1500；設施產品在容量不足時留在原設施，不會遺失。
- 所有非小屋建物都可拆除；拆除是一筆伙伴施工工作，會占用伙伴並依真實時間完成。
- 有加工中、待領產品或在途物流的設施會拒絕拆除；島主小屋只能升級，不能拆除。
- 小島機場已簡化為單一陸地格；合作碼頭仍是一格海岸土地加一格相鄰海面。
- 船運從碼頭的海面 footprint 起點做六角海格 BFS，只沿海洋格前往地圖邊緣，不穿過陸地，也不會把點線畫到港口後方；飛機維持直線。
- 已送出的送貨工作點擊後只顯示唯讀明細，沒有修改、取消或重新送出的控制項。
- 到貨並首次領取報酬時會彈出航空信封風格的簡短感謝函；同一 shipment 只建立一次。
- 統計表累積生產、送出、本島市場售出、跨島市場售出、三類收入、訪客總數／排行、拆除數與最近物流；資料由事件寫入，不從剩餘庫存倒推。

## 產業與載具

既有蔬果、穀物、茶、咖啡、可可、畜產、紡織、烘焙與餐飲鏈全部保留；新增：

- 育苗園：培育樹苗。
- 永續森林：投入樹苗，造林後選擇性伐木取得原木。
- 製材所：原木加工為木材。
- 造船廠：木材＋島花布製造物流船。
- 小島礦場：生產金屬礦。
- 輕金屬冶煉廠：金屬礦加工為輕金屬板。
- 飛機工坊：輕金屬板＋島花布組裝物流飛機。

物流規則：

- 有碼頭但沒有物流船，不能海運；有機場但沒有物流飛機，不能空運。
- 每艘船／每架飛機同時只能執行一筆在途 shipment；持有越多載具，可同時送出的班次越多。
- 在途載具仍保留在玩家庫存，但會被標為使用中，不能同時出售或當成另一筆貨物送出。
- 海運 60 分鐘、單次 20 件、免運費；空運 15 分鐘、單次 8 件、每件運費 2 金幣。

## 跨玩家合作與市場

地圖邊緣只列出有相容加工設施或市場的玩家，顯示伙伴、名稱與可接收能力。點選玩家後可選：

1. 送到對方加工設施：貨物抵達後，自動在對方工廠建立加工批次。
2. 賣到對方市場：貨物抵達即成交，不建立加工批次。

跨島市場單價固定為本島市場基準價的 `ceil(1.75 倍)`，畫面同時顯示跨島報酬與本島直售金額。這讓沒有同類工廠的玩家也能合作，且合作收益有明顯誘因。

加工廠仍不設批次容量；每筆到站原料建立獨立加工工作。成品完成後停在設施，玩家點領取才進島主小屋倉庫。

## 真實時間與資料量

- 施工、生產、加工、景觀收入與物流都保存開始／完成時間；玩家進入、回前景或同步時，以時間差一次結算。
- 不用長時間 timer 當完成依據，不逐秒寫資料庫，也不保存船機每分鐘座標。
- 地圖拖曳、縮放、海浪、伙伴與載具動畫都只在客戶端執行。
- 完整小島狀態仍存於 `progress.island` 並隨 `SUDOX3` 存檔同步；跨玩家交接另外使用正規化 shipment 事件。

## 雲端架構

Migration：`supabase/island-logistics-migration.sql`

Production project：`riradorayjziystoalyj`。v47 migration 已成功套用並驗證：

- `island_recipe_catalog` 共 54 筆。
- 其中 40 筆為可信任的跨島市場收購價。
- 林業／製材／冶煉新增 3 筆單一原料跨島加工配方。
- `dispatch_island_shipment` 已包含船機持有量、在途數與到期班次結算防線。
- `list_compatible_island_players` 已回傳 `market_facility_id`，不需要把 40 個市場品項逐一塞進合作玩家清單。
- 半徑 8 的公開建物快照上限調為 250 筆／100000 bytes。

三張私有表：

- `island_network_profiles`：公開身份與設施快照；庫存只供安全 RPC 原子扣除。
- `island_recipe_catalog`：伺服器可信的加工／市場品項、價格與工期。
- `island_shipments`：出發、抵達、報酬、匯入與防重確認事件。

五個 security-definer RPC：

- `publish_island_network`
- `list_compatible_island_players`
- `dispatch_island_shipment`
- `get_island_logistics`
- `ack_island_logistics`

所有資產寫入 RPC 都驗證玩家 UUID 與既有 4 位家庭 PIN；同一 `operation_id` 重送只回傳既有 shipment，不重複扣貨。

## 主要檔案

- `src/island/catalog.js`：schema v3、半徑 8、五級小屋、品項、配方與建築。
- `src/island/attractions.js`：可重現的訪客選擇，畫面與統計共用。
- `src/island/model.js`：正規化、容量、施工／拆除／升級、生產、統計與感謝函。
- `src/island/logistics.js`：載具併發、跨島加工／市場報價、防重合併與測試島友。
- `src/island/renderer.js`：海格路線、唯讀物流、倉庫、統計與航空感謝函 UI。
- `src/state/island-cloud.js`：五個物流 RPC adapter。
- `supabase/island-logistics-migration.sql`：正式資料表、價格目錄與安全 RPC。
- `scripts/test-island.mjs`：217 格、容量、升級、拆除、產業、船機、海路、交易、統計、感謝函與 SQL 回歸測試。
- `docs/island-building-architecture.md`：完整產品、資料、免費方案負載與素材標準。

## 正式素材待補

- 小屋 1～5 級成品圖，最高級為城堡。
- 育苗園、森林、製材所、造船廠、礦場、冶煉廠、飛機工坊。
- 物流船、物流飛機與海格航線動畫。
- 建造、升級、拆除的 3 個施工階段 Animated WebP。
- 六方向碼頭；機場只需單格成品與施工圖。

素材缺少時都會走 `src/island/assets.js` 的 emoji fallback，不影響資料與互動測試。

## 仍待正式上線前處理

- `ISLAND_TEST_MODE` 目前故意維持 `true`；測試資源、測試島友與「馬上完成」仍存在。
- 正式公開經濟前，應把 4 位家庭 PIN 升級為可撤銷裝置 token。
- shipment 明細目前讀取近 30 天；擴量前應增加完成事件彙總與清理排程。
- 正式像素素材與音效尚未製作。

## 驗證與提交規則

- 必跑：`npm.cmd run check`、`git diff --check`。
- 本機頁面：`http://127.0.0.1:4173/#island`。
- 瀏覽器需驗證：217 格、拖曳／縮放、小屋容量、拆除、統計、感謝函、港口海路與手機版操作。
- 不可納入既有未追蹤內容：`preview/`、`public/assets/eel-orange.gif`、`public/assets/eel-white.gif`、`public/assets/friend-mouse-v1.jpg`、`scripts/__pycache__/`。

### PUSH 前硬性檢查

1. 把 `src/island/catalog.js` 的 `ISLAND_TEST_MODE` 改成 `false`。
2. 確認畫面沒有「測試資源 ∞」、測試島友與「馬上完成」。
3. 重跑 production 的 migration，確認 54／40／3／true／true 驗證結果。
4. 重跑完整檢查並再升一次可見版次與 Service Worker cache。
