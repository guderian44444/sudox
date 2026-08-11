# 小島建設正式上線 Checklist

- 適用分支：`feature/island-building`
- 目前基準：app `v51`、Service Worker `sudox-shell-v51`
- Production Supabase project：`riradorayjziystoalyj`
- 更新日期：2026-08-11

本文件是可執行的上線 runbook。玩法與資料設計請看 `docs/island-building-architecture.md`，素材請看 `docs/island-asset-integration-guide.md`。

## 1. 先決定上線層級

| 層級 | 可否使用目前 4 位家庭 PIN | 素材要求 | 結論 |
|---|---|---|---|
| 家庭／受邀封閉測試 | 可暫用，但不可把 PIN 當公開密碼散發 | emoji／CSS fallback 可接受 | 可依本 checklist 上線 |
| 公開測試、沒有真實金流 | 不建議；至少限制帳號建立、RPC 頻率並可撤銷裝置 | 可部分 fallback，但首頁需標示測試 | 先補濫用防護 |
| 長期公開經濟或付費產品 | 不可只靠 4 位 PIN | 正式素材、授權與內容稽核完成 | 必須先改高熵、可撤銷、會過期的裝置 token |

目前程式適合第一層。若「正式上線」是完全公開服務，身份驗證是安全上線前置工作，不應靠 UI 隱藏補救。

## 2. GO／NO-GO 摘要

### 必須為 GO

- [ ] `ISLAND_TEST_MODE === false`。
- [ ] 畫面沒有「測試資源 ∞」、測試島友與「測試：馬上完成」。
- [ ] `APP_VERSION`、`APP_LAST_UPDATED`、`sw.js` 的 `CACHE_NAME` 同批更新。
- [ ] production migration 已重跑且目錄為 54 筆，其中市場收購 40 筆。
- [ ] `npm.cmd run check`、`git diff --check` 通過。
- [ ] 桌面與 390×844 手機完成核心 smoke test。
- [ ] 新玩家、既有玩家、第二裝置各測一次存檔恢復。
- [ ] 真實兩位玩家完成一趟出貨、到貨付款、感謝函與接收方加工／領取。
- [ ] release commit 只含核准檔案，沒有臨時素材、preview 或 `__pycache__`。

### 可選擇 fallback 後 GO

- [ ] 正式像素圖未全數完成：可保留 emoji／CSS soft-launch，但需記錄哪些 key 尚未登錄。
- [ ] 若宣告「全素材完成」，必須另跑 `npm.cmd run check:island-assets -- --require-files`；一般 soft-launch 只需結構 gate。
- [ ] 音效尚未接入：不是核心功能 blocker，不可臨時加入未受控自動播放。

### 任一成立即 NO-GO

- [ ] 測試模式仍為 `true`。
- [ ] migration／RPC 版本與前端 catalog 不一致。
- [ ] 跨島出貨可重複扣貨、重複付款或同一載具同時出兩趟。
- [ ] Service Worker 更新後仍載入舊版 JS／CSS。
- [ ] 舊存檔進島後遺失建築、倉庫、金幣或半徑 8 地圖資料。
- [ ] production console／network 出現未處理錯誤。

## 3. 封版變更

### 3.1 關閉測試模式

正式版在 `src/island/catalog.js`：

```js
export const ISLAND_TEST_MODE = false;
```

若要暫時恢復內部測試，把同一常數改成 `true` 即可恢復無限資源、demo 島友與立即完成；只能在獨立測試分支使用，完成後改回 `false`。不要把它接到 URL、localStorage 或公開設定畫面。正式發佈以 `npm.cmd run check:release` 強制檢查。

關閉後驗證：

- 新建、填海、升級、雇工會真正扣金幣。
- 市場售出與到貨會真正加金幣。
- 沒有 demo partner fallback；無相容玩家時顯示空狀態。
- 工作與物流不能用「馬上完成」。

不要為了上線把工期改成數秒；測試時間只能由測試資料或獨立測試模式控制。

### 3.2 同步版次與 PWA cache

同一個 release commit 修改：

- `src/app.js`：`APP_VERSION`。
- `src/app.js`：`APP_LAST_UPDATED`，使用含 `+08:00` 的 ISO 時間。
- `sw.js`：`CACHE_NAME`，例如 `sudox-shell-v51`。
- `index.html`、所有 ES module import 與 `sw.js` 的 `RELEASE_QUERY` 必須同步使用 `?v=v51`，避免 GitHub Pages CDN 或舊 PWA 快取混用跨版模組。
- `HANDOFF_ISLAND.md` 與本文件的目前基準。

若有新增「首屏必要」檔案才加入 `APP_SHELL`。大量伙伴動畫、建築與產品維持 runtime 按需抓取，fetch handler 會在成功下載後放入 cache。

## 4. Production 資料庫

Migration：`supabase/island-logistics-migration.sql`。此檔使用 transaction、`create table if not exists`、`create or replace function` 與 upsert，可重複套用；不要在上線日手動刪表或清 shipment。

套用後在 SQL Editor 執行只讀驗證：

```sql
select
  count(*) as total_recipes,
  count(*) filter (where building_id = 'market') as market_offers,
  count(*) filter (
    where recipe_id in ('forestGrowth', 'lumberBatch', 'metalPlateBatch')
  ) as new_single_input_recipes
from public.island_recipe_catalog;
```

預期：`54 / 40 / 3`。

再驗證五個公開 RPC 存在：

```sql
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'publish_island_network',
    'list_compatible_island_players',
    'dispatch_island_shipment',
    'get_island_logistics',
    'ack_island_logistics'
  )
order by proname;
```

預期 5 列。不要用 service-role token 做瀏覽器 smoke test；要測匿名／一般使用者實際會走的 RPC 權限。

### 上線前備份記錄

- [ ] 記錄 migration commit SHA 與執行時間。
- [ ] 記錄三張表目前列數：`island_network_profiles`、`island_recipe_catalog`、`island_shipments`。
- [ ] 匯出 schema 或確認 Supabase 專案的備份／PITR 能力與目前方案。
- [ ] 不在文件、截圖或 issue 貼 service-role key。

## 5. 自動檢查

在 `D:\AI\SUDOX`：

```powershell
npm.cmd run check:island-assets
npm.cmd run check
npm.cmd run check:release
git diff --check
git status --short --branch
```

預期：

- 素材結構與伙伴直接素材 gate 通過；正式 manifest 未滿時以 fallback 數量呈現，不算錯誤。
- core 與 island regression 全部通過。
- 沒有 whitespace error。
- staging／worktree 只有本次 release 預期檔案。

需特別排除的既有未追蹤內容：

- `preview/`
- `public/assets/eel-orange.gif`
- `public/assets/eel-white.gif`
- `public/assets/friend-mouse-v1.jpg`
- `scripts/__pycache__/`

## 6. 瀏覽器 smoke test

啟動：

```powershell
npm.cmd run dev
```

使用 `http://127.0.0.1:4173/#island`。不要誤用 5173；它可能是另一個專案。

### 桌面

- [ ] 一頁可看完主要地圖與面板，不需整頁上下拉動才能操作。
- [ ] 滾輪只縮放地圖；按住拖曳不誤點格子。
- [ ] 217 格存在，初始陸地連通，陸塊中間沒有海水裂縫。
- [ ] 驚嘆號在建築、伙伴與岸浪上層。
- [ ] 小屋顯示容量、庫存與五級升級；Lv.5 為城堡。
- [ ] 機場一格可建；碼頭自動朝向相鄰海格。
- [ ] 拆除會占用伙伴，忙碌／有待領品／在途物流時正確拒絕。
- [ ] 統計表可開啟，生產、送出、售出、訪客與排行有合理數值。

### 手機 390×844

- [ ] 單指按住拖曳、短點格、右上縮放皆可用。
- [ ] 沒有水平頁面溢出；safe area 不遮底部面板。
- [ ] 施工倒數只在面板／工作列，地圖不遮伙伴。
- [ ] 巢狀建築分類可展開，按鈕至少可可靠點擊。
- [ ] 感謝函完整顯示，可關閉，不超出 viewport。

### PWA／離線

- [ ] 清除舊站點資料後首次載入成功。
- [ ] 安裝／重載後版次與最後更新時間正確。
- [ ] 更新 Service Worker 後不再顯示上一 cache 版本。
- [ ] 已載入過小島後離線可觀看；需雲端的跨島操作顯示明確失敗，不偽裝成功。
- [ ] 回到前景時以時間差正確結算，不因 timer 暫停漏算或重複領取。

## 7. 兩位真實玩家的端到端驗收

至少使用 A、B 兩個不同玩家 UUID：

1. B 建立市場與至少一個可接收 A 原料的加工設施，完成雲端發布。
2. A 在地圖邊緣看到 B 的伙伴、名稱與接收能力。
3. A 從碼頭／機場選 B、運送方式、品項與數量；報價同時顯示本島市場比較。
4. 海運需要船且路徑只走海格；空運需要飛機且可直線飛行。
5. 送出後 shipment 只能看，不能修改；載具使用中數量正確。
6. 到期後 A 收到一次金幣與一次可愛感謝函，不重複彈出。
7. 若目的地是 B 的市場，抵達即成交；若是工廠，B 出現加工批次，完成後點領取才進倉庫。
8. 重送同一 `operation_id` 不重複扣 A 的貨或發錢。

## 8. Commit、PUSH 與部署

- [ ] 先看 `git diff --cached --check`、`git diff --cached --stat`、`git diff --cached --name-status`。
- [ ] release commit 訊息包含小島正式上線與版次。
- [ ] branch 尚無 upstream 時，明確確認要推到哪個遠端分支；不要默認覆蓋 `main`。
- [ ] 若要合併至線上分支，先確認該分支沒有別人的新提交，再使用非破壞性 merge。
- [ ] 部署完成後以線上網址做同一組最小 smoke test，並確認 footer 版次。

本次 v51 尚未取得正式 PUSH／部署授權；完成雲端 migration 與驗證後，仍須由使用者明確指示。

## 9. 回滾

前端回滾優先部署上一個已知正常 commit，不執行 `git reset --hard`，也不刪 production 表。

### 只壞畫面／素材

1. 部署上一版 app／CSS／manifest。
2. 再提高一次 Service Worker cache 名稱，確保客戶端取得回滾版本。
3. 保留新資料表與 shipment，不做資料回退。

### 物流／經濟異常

1. 暫時部署上一版不提供小島入口的穩定前端，停止新增操作。
2. 保留 `island_shipments` 原始事件與 operation ID，先做只讀稽核。
3. 不直接批次補錢或刪 shipment；先確認重複範圍與可重現條件，再寫可重跑、有 operation ID 的修復 migration。
4. 修復後以測試玩家驗證，再恢復入口。

### 存檔異常

1. 不讓舊客戶端覆寫較新的 `SUDOX3` 雲端進度。
2. 保存一份問題玩家匯出檔與 `progress.island`，再修正 normalizer／migration。
3. 加入舊 schema 回歸測試後才重新部署。

## 10. 上線後 24 小時監測

- [ ] 前 1 小時與 24 小時檢查 Supabase RPC 錯誤率。
- [ ] 檢查 `island_shipments` 是否大量卡在 `in_transit` 且早已超過 `arrives_at`。
- [ ] 檢查同一 `operation_id` 是否出現重複事件。
- [ ] 檢查 profile snapshot 是否接近 100000 bytes 或 250 建築上限。
- [ ] 檢查 Service Worker 是否造成舊版持續存活。
- [ ] 蒐集桌面／iPhone 的拖曳、縮放、感謝函與物流回報。
- [ ] 一週內評估 30 天 shipment 明細清理／彙總排程與裝置 token hardening。
