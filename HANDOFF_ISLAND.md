# 小島建設模式 Handoff

更新日期：2026-08-09
開發分支：`feature/island-building`
分支起點：`f10946a`（建立分支時的 `main`）
目前版次：`v43`／Service Worker `sudox-shell-v43`

## 一句話狀態

可操作的 Foundation 已完成：玩家可從數獨主畫面進入 61 格六角小島，拖曳／縮放地圖、按伙伴專長派工、從分類目錄建設、切換作物與非殺生畜產、加工 2～4 層產品鏈、保存到無上限倉庫並在市場出售；正式美術與跨玩家物流尚未實作。

## 已完成

- 主畫面桌機／手機皆有「小島」入口，可回到原本數獨局且保留 session。
- 新玩家從半徑 1 的 7 格小島開始，完整地圖半徑 4，共 61 格。
- 初始設施只有島主小屋；小屋同時是無上限倉庫，不再占用第二格土地。首次進入仍只會發一次 100 金幣開發金。
- 填海造陸：必須與現有土地相鄰，費用會隨已填格數提高。
- 建築：分類巢狀選單共 16 項，包含菜園、玉米田、果園、蜂園、友善牧場、食品工房、咖啡烘焙坊、咖啡館、織布工坊、烘焙屋、市場、工務小屋、燈塔、花園、睡蓮池與遊樂場。
- 地圖：滑鼠點住或手機手指按住可拖曳；拖動超過門檻會抑制格子 click，避免誤選。縮放後與重繪後保留地圖捲動位置。
- 施工：地圖只顯示半成品與工作伙伴，倒數集中在點選面板與底部工作列；最多 3 位伙伴，增加伙伴會依「剩餘工作量」重算較早的 `readyAt`。
- 伙伴派工：每位伙伴同時只能參與一項施工；自己的伙伴忙碌時，新工程必須選擇並雇用另一位空閒伙伴。
- 伙伴專長：25 位伙伴各自有明確能力，符合建築 `workTags` 時實際縮短工期 20%～50%；熊的「大力土木」對土木／重型工程縮短 50%。伙伴選單、建築卡與施工面板都會顯示是否生效。
- 桌面版：整個小島畫面固定在一個 viewport，地圖依視窗高度給初始縮放；縮放按鈕位於地圖右上，也可在地圖上用滾輪縮放。
- 底部列：不再常駐顯示庫存，改為目前施工、生產與加工工作；點工作可定位對應格。
- 庫存：點選島主小屋才顯示無上限庫存。
- 測試模式：`src/island/catalog.js` 的 `ISLAND_TEST_MODE = true` 會顯示資源無限並允許施工／生產「馬上完成」。推送或部署前必須改成 `false` 並重新跑完整測試。
- 時間：沒有每秒寫入資料庫；只保存 `startedAt`／`readyAt`，進入、操作、恢復前景或倒數到期時結算。
- 生產：菜園可切換葉菜、胡蘿蔔、番茄、草莓；果園可切換水果、咖啡、可可；另有玉米田與蜂園。成熟後停在可領取，收成後進倉庫並開始同品項下一批。
- 非殺生畜產：友善牧場只生產牛奶、雞蛋與羊毛，不設肉品或屠宰流程。
- 加工：乳製品、果醬、巧克力、烘焙咖啡豆、拿鐵、島花布、蜂蜜蛋糕均有對應設施；同一工廠允許多個加工工作平行存在，完工品累積等待領取。
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
- 忙碌伙伴由所有 `constructionJobs[].workerIds` 聯集決定；Renderer 不能自行判斷可用伙伴，必須使用 model 的可用名單。
- Source 設施用 `facilities[].readyOutput` 保存一批待領收成；Processor 用 `readyOutputs` 合併多批待領結果。

## 主要檔案

- `src/island/catalog.js`：建築、品項、配方、費用與工期。
- `src/island/companions.js`：25 位伙伴專長、適用標籤、工期倍率與團隊速度公式。
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
- 建築移動／拆除、繁榮度、裝飾效果、設施升級與額外施工欄位。
- 正式像素建築的地基／半成品／接近完工／完工四階段動畫。
- 伺服器可信時間；Foundation 使用裝置現在時間，因此玩家手動調整手機時鐘仍可能影響本機完工判定。社交物流必須改用伺服器時間。
- 完整跨裝置併發編輯；現在採「較新完整存檔勝出＋生命週期統計高水位」，不適合兩台裝置同時建設。

## 驗證紀錄

2026-08-09 已完成：

- `npm.cmd run check`：通過（核心規則＋25 位伙伴能力＋全部來源／加工配方巡檢）。
- `git diff --check`：通過。
- 本機 `http://127.0.0.1:4173/`：可進入小島、指派不同伙伴、雇用加速，以及用測試按鈕立即完成施工／生產。
- v42 桌面瀏覽器：61 格地圖與單頁版面正常；5 個建築分類、16 項建築、25 位伙伴能力皆可由操作面板存取。
- 熊建造工務小屋顯示 `×2.00`，基礎 2 小時縮為 1 小時；珊瑚燈塔由 6 小時縮為 3 小時，證明專長有寫入實際工作時間。
- 菜園可從葉菜改種胡蘿蔔並重設為 30 分鐘；友善牧場顯示牛奶、雞蛋、羊毛三種非殺生配方。
- 地圖拖曳使用統一 Pointer Events，包含 6 px 移動門檻、拖後 click 抑制、`touch-action: none` 與位置保存；靜態回歸測試已覆蓋事件接點，仍建議實機上線前各做一次 iPhone／Android 慣用手勢驗收。
- v43 修正：`pointerdown` 不再立即呼叫 Pointer Capture，只有移動超過 6 px、正式進入拖曳時才接管；避免真實滑鼠／觸控的格子與按鈕 click 被地圖容器吃掉。
- 重新載入後施工與金幣仍存在。
- 390×844 手機 viewport：61 格地圖、倉庫與控制面板存在，頁面無橫向溢出，console 無 error／warning。
- 1366×768 桌面 viewport：頁面寬高與 viewport 相同，不需捲動整頁；地圖無施工倒數覆蓋，工作列、右上縮放與測試控制存在。

## 下一位開發者建議順序

1. 先補多格 footprint 的占用、預覽與旋轉，再開放碼頭／機場建造。
2. 依架構書建立 Supabase migration、RLS 與 idempotent RPC；物流與錢包異動不能只信任前端。
3. 完成 `shipment -> arrival payout -> receiver processing job` 狀態機與 30 天物流保留清理。
4. 依 AI 美術標準逐項接入正式 WebP，先從地形、施工四階段、菜園／玉米田／牧場／工廠開始。
5. 補 server-time offset、跨裝置 revision／衝突提示，再開放線上合作測試。

## Git 注意事項

本工作區原本就有以下未追蹤內容，本分支不可誤納入：`preview/`、`public/assets/eel-orange.gif`、`public/assets/eel-white.gif`、`public/assets/friend-mouse-v1.jpg`、`scripts/__pycache__/`。提交時只 stage 小島功能、文件，以及本次明確修改的既有檔案。

### PUSH 前硬性檢查

1. 把 `src/island/catalog.js` 的 `ISLAND_TEST_MODE` 改成 `false`。
2. 確認畫面不再出現「測試資源 ∞」與「馬上完成」。
3. 重新執行 `npm.cmd run check`、`git diff --check` 與桌機／手機瀏覽器驗證。
