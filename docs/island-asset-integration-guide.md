# 小島素材接入與友軍交接指南

- 適用版本：小島架構 v50、素材目錄 `island/v1`
- Style ID：`SUDOX Buddy & Island Style v1`
- 更新日期：2026-08-09
- 目的：讓美術 AI、前端與驗收人員能分工，不需要猜 assetKey、尺寸、fallback 或程式接點

## 1. 先看哪一份文件

| 需求 | 單一權威來源 |
|---|---|
| 目前做到哪裡、下一步與禁碰檔案 | `HANDOFF_ISLAND.md` |
| 玩法、資料流、時間結算、物流與 Supabase 架構 | `docs/island-building-architecture.md` |
| 角色與像素建築的完整視覺標準、prompt、negative prompt | `docs/sudox-ai-art-style-guide.md` |
| assetKey、檔案放置、renderer 接法與驗收 | 本文件 |
| 正式上線步驟、回滾與監測 | `docs/island-production-launch-checklist.md` |

若文件與程式不一致，以 `src/island/catalog.js` 的品項／建築資料、`src/island/renderer.js` 的實際使用方式、`src/island/assets.js` 的 manifest 為準，並同步修正文件。

## 2. 目前素材接點真實狀態

「已接通」表示把正確檔案放入 `public/assets/island/v1/` 並登錄 manifest 後，既有 renderer 會直接顯示；「已預留」表示 catalog 有 assetKey，但畫面目前仍輸出 emoji；「需擴充」表示目前由 CSS 或直接路徑提供，不能只加 manifest。

| 類型 | 數量 | 狀態 | 現行接點與用途 |
|---|---:|---|---|
| 建築完工圖 | 40 個建築 key | 已接通 | 地圖建築與建築選單共用 `building.assetKey` |
| 小屋等級 | 5 級，其中 Lv.1 與建築 key 重複 | 已接通 | 地圖依 `building.level` 改用 `HOME_LEVELS[n].assetKey` |
| 通用施工圖 | 4 個 key | 已接通 | `construction/building`、`reclaim`、`homeUpgrade`、`demolition` |
| 產品／原料／載具圖示 | 40 個 key | 已預留 | `ITEM_CATALOG[*].assetKey` 已存在，但庫存、市場、配方、統計仍使用 `item.icon` |
| 伙伴靜態圖 | 25 張 PNG | 已接通（直接路徑） | `public/assets/friends/{id}.png`；施工、訪客、島友、感謝函寄件人 |
| 伙伴舞蹈 | 100 個 Animated WebP | 可重用但小島未接 | `friends-dance/{id}_{1..4}.webp`；可用於完工與遊樂事件 |
| 伙伴暈倒 | 25 個 Animated WebP | 保留 | 不建議當施工動畫，可供趣味事件使用 |
| 地形、海面、岸浪 | CSS 現行 | 需擴充 renderer | `.island-hex`、`.island-wave`、`.island-shore-foam.dir-0..5` |
| 船、飛機與航線 | emoji＋SVG/CSS 現行 | 需擴充 renderer | `transportMarkup()` 以物流方法 icon 畫載具，以 SVG path 畫點線 |
| 伙伴工作動畫 | 靜態 PNG＋CSS bob 現行 | 需擴充 renderer | `workerMarkup()`；正式動畫需依伙伴 ID 與工作類型選檔 |
| 到貨感謝函 | CSS＋伙伴 PNG | 已完成，不需整張圖 | 信封框、郵戳、地址與文字皆須保留可翻譯 DOM 文字 |
| 音效 | 0 | 未接 | 目前沒有音訊管理器，不可只丟音檔期待播放 |

目前共 48 個「已接通」的唯一 manifest key：44 個建築／小屋完成圖，加 4 個通用施工圖。產品另有 40 個預留 key。確切清單不要手抄，執行：

```powershell
npm.cmd run check:island-assets -- --list
```

## 3. 正式檔案放置與 manifest

所有小島正式素材放在版本目錄：

```text
public/assets/island/v1/
  buildings/
    garden/
      complete.webp
      complete.json
    island-home-level-1/
      complete.webp
      complete.json
  construction/
    building.webp
    building.json
    reclaim.webp
    home-upgrade.webp
    demolition.webp
  items/
    vegetable.webp
    vegetable.json
  actors/
  terrain/
  vehicles/
  fx/
  ui/
```

檔名與資料夾只能用小寫英文、數字、連字號。正式執行檔優先為透明 lossless WebP；保留 PNG／Aseprite／PSD master，但 master 不放進 PWA 必載清單。

已接通素材在 `src/island/assets.js` 登錄相對路徑：

```js
export const ISLAND_ASSET_MANIFEST = Object.freeze({
  "buildings/garden": "buildings/garden/complete.webp",
  "buildings/island-home-level-2": "buildings/island-home-level-2/complete.webp",
  "construction/building": "construction/building.webp",
  "construction/homeUpgrade": "construction/home-upgrade.webp"
});
```

注意事項：

- key 大小寫必須與 catalog／job kind 完全相同；`homeUpgrade` 是目前唯一含大寫字母的既有施工 key，不可自行改成別的 job kind。檔案路徑仍使用 `home-upgrade.webp`。
- manifest 未登錄時會安全顯示 emoji fallback。
- manifest 已登錄但檔案不存在、格式損壞或伺服器 MIME 錯誤時，瀏覽器會顯示破圖，不會自動退回 emoji；提交前必須跑素材稽核與瀏覽器檢查。
- 不在 catalog 裡硬寫實體路徑；版本根目錄只由 `assets.js` 管理。
- 更新 `island/v1` 內已上線同名檔案時，仍要提高 Service Worker cache 名稱；大量改版則建立 `island/v2` 並改 `assetBase`。

## 4. key 家族與應用方式

### 4.1 建築與小屋

- key：`buildings/{kebab-id}`；小屋為 `buildings/island-home-level-{1..5}`。
- 目前同一張 `complete.webp` 同時用於 45×45 CSS px 地圖圖示與 35×35 CSS px 建築選單。
- 單格素材使用 192×192 RGBA 畫布，建築底部中心 anchor 一致，正面朝畫面下方。
- 主要剪影建議占畫布 70～82%，底部落在 y=164～176；煙囪、樹冠可向上延伸，但不可讓相鄰格的互動狀態完全被遮住。
- 合作碼頭是唯一兩格 footprint；成品視覺必須讓陸地端與海面端清楚連續。方向版尚未接進 manifest，接手者若製作六方向版本，需同時擴充 `mapCellMarkup()` 依 `building.orientation` 選圖。
- 機場固定單格，不再製作舊版多格跑道。
- 小屋 Lv.1～5 必須從同一 footprint 漸進擴建；Lv.5 是海島城堡，不能像完全不同地點的建築。

### 4.2 施工狀態

現在 runtime 只有四個「工作種類」通用圖，不會依進度自動切地基／半成品／接近完工：

| key | 對應 job kind | 現行用途 |
|---|---|---|
| `construction/building` | 一般建造 | 所有設施建造中共用 |
| `construction/reclaim` | 填海 | 海格施工中 |
| `construction/homeUpgrade` | 小屋升級 | Lv.2～5 擴建中 |
| `construction/demolition` | 拆除 | 所有拆除工作共用 |

若要接「每棟建築三階段」，請在 `assets.js` 增加狀態解析函式，並在 `mapCellMarkup()` 依 `(now - startedAt) / (readyAt - startedAt)` 選 `foundation`、`half`、`nearly-done`；不要把階段判定存進玩家存檔。三張圖必須共用畫布、anchor、鏡頭與光源。

Animated WebP 適合伙伴和小型循環，不建議把每棟施工本體都做長動畫；建築階段用靜態 WebP，煙塵／敲擊火花用共用 sprite sheet，比較省行動裝置解碼量。

### 4.3 產品與原料

- key：`items/{kebab-id}`，共 40 個，唯一清單由 `ITEM_CATALOG` 產生。
- 主檔 128×128 RGBA；48×48 仍需不看文字即可辨識。
- 單物件、粗深色輪廓、透明背景；數量、金幣、鎖定與在途狀態由 UI 疊加，不畫在素材內。
- 同產業鏈需有家族感，但原料／半成品／完成品輪廓要不同，例如原木、木材、物流船不能只換顏色。

目前 item key 尚未被 renderer 消費。接入時至少要同步修改：

- `outputMarkup()`：配方產出與待領產品。
- `homeInventoryMarkup()`：小屋倉庫。
- `marketPanel()`：本島市場。
- `logisticsPanel()`：跨島加工／市場選單；原生 `<option>` 不適合圖片，若要顯示圖必須改成可存取的自訂清單。
- `statisticsPanel()`：生產／送出／售出統計。

每個位置都必須保留 `item.icon` fallback 與可讀文字，不可只輸出沒有 alt／label 的圖。

### 4.4 伙伴、遊客與施工動畫

- 角色身份基準永遠是 `public/assets/friends/{id}.png`，AI 不可憑動物名稱重新發明臉與斑紋。
- 伙伴靜態主圖為 1024×1024 RGBA；現行地圖工作者顯示 22×22、訪客 19×19、面板 29×29、島友節點 32×32 CSS px。
- 工作動畫輸出 220×220 RGBA Animated WebP、24～30 幀、12～15 fps、1.6～2.2 秒無縫循環；腳底 anchor 固定。
- 建議 key／檔名：`actors/work/{friend-id}-{action}.webp`，action 只用 `hammer`、`dig`、`water`、`carry`、`harvest`、`load` 等單一動作。
- 工作類型由工程 `workTags` 決定，不要為 40 棟建築各做 25 份動畫。可先建立 tag→action 對照，再以伙伴 ID 選檔；缺檔時回到靜態 PNG＋CSS bob。
- 遊樂／景觀設施的隨機訪客仍由 `currentAttractionVisitorIds()` 決定；素材只負責表現，不得用動畫隨機結果反推收益。
- 完工慶祝可重用 `friends-dance/{id}_{1..4}.webp`，但要按需載入，不納入全部 APP_SHELL。

### 4.5 地形、岸浪、航線與載具

目前這幾類不是 manifest 換圖點：

- 海面／陸地：`.island-map-viewport`、`.island-hex.is-water`、`.is-land`、`.is-reclaimed`。
- 六方向岸浪：`.island-shore-foam.dir-0..5`，方向順序必須跟 `HEX_DIRECTIONS` 完全一致。
- 路線：`transportMarkup()` 產生 SVG path，船運路徑來自海格 BFS，飛機為直線。
- 載具：`.island-transport` 目前顯示 `LOGISTICS_METHODS[methodId].icon`。

正式接圖時保留現有路徑計算，只替換視覺：

1. 地形以 128×112 的 2×輸出對應 64×56 邏輯格；CSS hit area 目前為 66×58，用來蓋住格間細縫。
2. 岸邊仍採 6 張 edge overlay 組合，不製作 64 張鄰接整圖。
3. 船隻可依相鄰 path segment 選 6 方向 sprite；不可用直線角度穿越陸地。
4. 飛機只需一張或少量方向圖，可沿既有 offset path 移動。
5. 點點鏈線是資訊圖層，必須留在載具下方、地形上方；`prefers-reduced-motion` 時停止流動但仍可見。
6. 船、飛機的畫面位置不是物流完成依據，不能寫回資料庫。

### 4.6 UI、感謝函與音效

- 文字、價格、時間、數量、玩家名稱與狀態不得烘焙進圖檔。
- 感謝函保留 HTML 文字，以利動態填入寄件玩家、貨物與金額；可新增郵票、貼紙或小印章，但不能交付一張不可翻譯的整封信圖片。
- UI 圖示可用 SVG 或 2× lossless WebP；文字保持現有平滑字體，不強制像素字。
- 未建立統一音訊管理器前，不把音效列為可直接接入素材。未來需支援靜音、音量、iOS 首次手勢解鎖、頁面背景停止與失敗 fallback。

## 5. SUDOX Buddy & Island Style v1 最低不可違反標準

完整規格與 prompt 在 `docs/sudox-ai-art-style-guide.md`；任何友軍交件至少要遵守：

- 伙伴是圓潤兒童貼紙感 chibi 動物：大頭、短身、短肢、純黑點眼、簡單嘴、2～5 個乾淨色塊。
- 不做寫實毛髮、3D 公仔、黏土、日系高光大眼、白色貼紙外框、文字、logo 或背景。
- 建築是明亮柔和的像素風，固定正交 3/4 俯視約 35°，正面朝下，左上光、右下短陰影。
- 深線使用 `#344256` 或角色近黑 `#050505`；主色需能與珊瑚 `#FF936F`、薄荷 `#86CFB5`、奶油白 `#FFFAF2` 共存。
- 相同角色、相同建築的所有狀態必須共用比例、鏡頭、anchor、光源與關鍵斑紋。
- 先做「海岸＋填海＋菜園＋市場＋蔬菜＋貓工作動畫」垂直樣板，在 390×844 實機尺寸確認後才批量生產。

## 6. sidecar JSON 與可重製性

每個 AI 產出必須有同名 `.json`。最低欄位：

```json
{
  "styleId": "SUDOX Buddy & Island Style v1",
  "assetId": "buildings/garden/complete",
  "sourceKey": "buildings/garden",
  "reference": "public/assets/friends/cat.png",
  "width": 192,
  "height": 192,
  "frames": 1,
  "fps": 0,
  "anchor": { "x": 96, "y": 174 },
  "footprint": [{ "q": 0, "r": 0 }],
  "prompt": "...",
  "negativePrompt": "...",
  "seedOrJobId": "...",
  "generatedAt": "2026-08-09T00:00:00Z",
  "reviewedAt390x844": false
}
```

非角色素材的 `reference` 可省略；動畫必須填 frames／fps；方向素材另加 `orientation: 0..5`。只交 WebP 而沒有 prompt、seed／job ID 與參考圖，視為不可維護交件。

## 7. 接入與驗收流程

1. 從 `catalog.js` 取得 key，不自行發明另一套 ID。
2. 依 Style ID 生成 master、runtime WebP 與 sidecar JSON。
3. 放入 `public/assets/island/v1/`，在 `ISLAND_ASSET_MANIFEST` 登錄已接通 key。
4. 執行結構與 fallback gate：

   ```powershell
   npm.cmd run check:island-assets
   ```

5. 查看完整清單：

   ```powershell
   npm.cmd run check:island-assets -- --list
   ```

6. 只有準備宣告「全 catalog 正式圖完成」時才跑完整檔案 gate：

   ```powershell
   npm.cmd run check:island-assets -- --require-files
   ```

7. 執行 `npm.cmd run check` 與 `git diff --check`。
8. 在 `http://127.0.0.1:4173/#island` 驗證 100%、縮小、放大、拖曳、手機 390×844、reduced motion 與離線重開。
9. 確認圖檔 MIME 正確、沒有破圖、白邊、髒 alpha、首尾跳動或遮住驚嘆號／伙伴。
10. 若變更可部署素材、manifest、CSS 或 renderer，同步提高 `APP_VERSION`、`APP_LAST_UPDATED` 與 `sw.js` 的 cache 名稱後再上線。

## 8. 提交邊界

- 每批素材提交只包含該批 WebP／JSON、manifest、必要 CSS／renderer 與對應文件。
- 不要順手納入 `preview/`、臨時輸出、AI 原始批次、`__pycache__` 或未確認的 JPG／GIF。
- PNG／Aseprite／PSD master 若過大，放到明確的來源素材儲存區，不要讓首次 PWA 安裝下載。
- 任何 assetKey 更名都要附存檔相容性與 manifest 遷移說明；一般只換 path，不改 catalog key。
