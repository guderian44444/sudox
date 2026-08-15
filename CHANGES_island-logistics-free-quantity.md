# 島嶼物流「送出數量」自由化 + 加工設施亂碼修復

> 日期：2026-08-15
> 狀態：**前端已改完並經主人手動驗證正常**；待主人 COMMIT。
> 完整 diff 另存於：`CHANGES_island-logistics-free-quantity.diff`（git diff 輸出，可直接 `git apply -R` 回滾）

---

## 1. 背景與目的

島嶼「跨島合作設施」表單原本把「送出物資數量」綁死成**食譜 `inputPerBatch` 的整數倍數**：

- 輸入框 `min` / `step` 都設成 `inputPerBatch`（例如玉米田食譜 `inputPerBatch=2`，就只能填 2、4、6…）。
- 每次切「合作對象 / 運輸方式」都會被程式**強制蓋回**成倍數。
- 後端 `shipmentQuote` 有 `count % inputPerBatch !== 0` 的硬驗證。

主人需求：**完全移除倍數限制**，讓「送出數量」可自由輸入任意正整數（1、2、3…），只要不超過該運輸方式的載量上限即可。

過程中主人又發現：**「送到加工設施」選項出現亂碼**（顯示成 `<img class="island-sprite island-ite...` 這種 raw HTML），一併修復。

---

## 2. 改動總表

| # | 檔案 | 改動 | 說明 |
|---|------|------|------|
| 1 | `src/island/logistics.js` | 移除 `count % inputPerBatch !== 0` 驗證 | 只保留「不可超過載量」檢查 |
| 2 | `src/island/logistics.js` | 到貨端 `batches` 移除 `Math.max(1, …)` | 送 1 個不再被白送成整批 |
| 3 | `src/app.js` | `updateIslandLogisticsQuote` 移除對齊邏輯 | 不再把數量蓋回倍數；`min=1 step=1` |
| 4 | `src/island/renderer.js` | 初始 `quantity` 改為 `1` | 預設填 1 而非 `inputPerBatch` |
| 5 | `src/island/renderer.js` | offer 尋找條件 `>= inputPerBatch` → `> 0` | 只要有庫存就能選 |
| 6 | `src/island/renderer.js` | **亂碼修復**：`escapeHtml(outputMarkup(...))` → `recipeOutputsLabel(entry)` | 加工設施選項改純文字 |
| 7 | `src/island/catalog.js` | `ISLAND_TEST_MODE` 曾 `false`→`true`，**現已還原回 `false`** | 測試用開關，收尾時已還原，**不會進 commit** |
| 8 | 多檔 import 行 | cache-busting `?v=v57` → `?v=v58` | 讓瀏覽器重新抓取模組（含 app.js / logistics.js / renderer.js 等） |

> 註：#8 的版本號 bump 是搭配本次改動一起做的，目的是讓 service worker / 瀏覽器 cache 抓到新檔案。`APP_VERSION` 在 `app.js` 原本已是 `"v58"`，所以 import 一併對齊到 v58。

---

## 3. 逐檔改動明細（before / after）

### 3.1 `src/island/logistics.js` — 送出端驗證（核心）

**改動 A：`shipmentQuote` 倍數驗證**

```js
// before
if (!count || count > method.capacity || count % offer.inputPerBatch !== 0) {
  return { ok: false, error: `數量必須是 ${offer.inputPerBatch} 的倍數，且不可超過 ${method.capacity}` };
}

// after
if (!count || count > method.capacity) {
  return { ok: false, error: `數量不可超過 ${method.capacity}` };
}
```

**改動 B：到貨端 `batches` 計算（`mergeCloudLogistics`）**

```js
// before
const batches = Math.max(1, safeInt(shipment.quantity) / Math.max(1, safeInt(shipment.inputPerBatch, 1)));

// after
const batches = safeInt(shipment.quantity) / Math.max(1, safeInt(shipment.inputPerBatch, 1));
```

> 為什麼改 B：`Math.max(1, …)` 會把「送 1 個玉米（= 0.5 批）」圓整成「1 整批」，等於白送。移除後 `batches` 變成純比例（可能是小數），產出 = 單批產出 × 實際批數，比例精確。
> ⚠️ 副作用：小數批數時，`safeInt(count) * batches` 可能算出非整數，下游 `safeInt` 會 floor。實際量小，影響極小；若主人發現產出數不對，這裡是第一排查點。

---

### 3.2 `src/app.js` — 輸入框行為（`updateIslandLogisticsQuote`）

```js
// before
quantityInput.min = String(selection.offer.inputPerBatch);
quantityInput.step = String(selection.offer.inputPerBatch);
if (methodDefinition) quantityInput.max = String(methodDefinition.capacity);
const aligned = Math.max(selection.offer.inputPerBatch, Math.floor((Number(quantityInput.value) || selection.offer.inputPerBatch) / selection.offer.inputPerBatch) * selection.offer.inputPerBatch);
quantityInput.value = String(methodDefinition ? Math.min(aligned, methodDefinition.capacity) : aligned);

// after
quantityInput.min = 1;
quantityInput.step = 1;
if (methodDefinition) quantityInput.max = String(methodDefinition.capacity);
// （移除 aligned 強制對齊的兩行；輸入值照樣被讀取）
```

> 效果：輸入框現在 `min=1 step=1 max=載量`，主人可任意 key 數字，程式不再蓋值。

---

### 3.3 `src/island/renderer.js` — 表單初始值與亂碼

**改動 C：初始數量 + offer 條件**

```js
// before
const offer = offers.find((entry) => availableInventoryQuantity(state, entry.itemId) >= entry.inputPerBatch) || offers[0];
const method = methods[0];
const quantity = Math.max(1, offer?.inputPerBatch || 1);

// after
const method = methods[0];
const offer = offers.find((entry) => availableInventoryQuantity(state, entry.itemId) > 0) || offers[0];
const quantity = 1;
```

> input 的 HTML 是模板字串 `min=${quantity} step=${quantity} value=${quantity}`，因為 `quantity` 常數變成 `1`，**自動**渲染成 `min="1" step="1" value="1"`，所以 input 那行本身不用改。

**改動 D：亂碼修復（見第 4 節）**

---

### 3.4 `src/island/catalog.js` — 測試模式（已還原）

```js
// 原本（HEAD）
export const ISLAND_TEST_MODE = false;
// 測試期間（mimi 曾改成）
export const ISLAND_TEST_MODE = true;
// 現在（收尾已還原，與 HEAD 一致，不會進 commit）
export const ISLAND_TEST_MODE = false;
```

> mimi 為了讓 demo 島友（老爸 / ANGEL / 摩卡）出現而暫時開成 `true`；**收尾時已還原回 `false`**，所以 `catalog.js` 目前與 git HEAD 一致、不在 diff 內。

---

## 4. 亂碼修復專項說明

**症狀**（主人截圖）：「送到加工設施」的兩個選項顯示成
```
咖啡烘焙坊 • ☕ 咖啡豆 → <img class="island-sprite island-ite...
```

**根因**：`renderer.js` 的 `offerOption` 對加工設施選項用了
```js
... → ${escapeHtml(outputMarkup(entry.outputs))}
```
- `outputMarkup(...)` 回傳的是 **HTML**（`<span class="island-sprite...">` 或 `<img ...>`）。
- 外面又套了 `escapeHtml()`，把 `<` `>` 轉成 `&lt;` `&gt;`，HTML 變成 raw 文字。
- 而且 `<option>` 標籤**本身不允許包含 HTML 子元素**，所以就算不 escape 也會被瀏覽器當文字。
- 「賣到對方市場」那項没用 `outputMarkup`（用純文字 `rewardPerItem`），所以一直正常。

**修法**：改用現成的**純文字**版 `recipeOutputsLabel(entry)`（`catalog.js:367`，格式如 `☕1`，emoji+數量，安全無 HTML）。該函式 `renderer.js` 第 11 行**本來就匯入了**，直接可用。

```js
// before
... → ${escapeHtml(outputMarkup(entry.outputs))}
// after
... → ${recipeOutputsLabel(entry)}
```

**驗證**：餵真實 renderer 一個「有 dock+船+咖啡豆」的 state，加工設施選項實際渲染為
```
咖啡烘焙坊・🫘 咖啡豆 → ☕1
織布工坊・🧶 羊毛 → 🪡1
```
掃描所有選項，**亂碼 0 處** ✅

---

## 5. 完整 git diff（回滾依據）

> 完整輸出另存於 `CHANGES_island-logistics-free-quantity.diff`（132 行，含 v57→v58 版本號 bump；`catalog.js` 已還原故不在內）。
> 這裡是**邏輯改動**（已剔除版本號噪音）的核心片段，詳細全文請看 diff 檔。

```diff
# ---- src/island/logistics.js ----
-  if (!count || count > method.capacity || count % offer.inputPerBatch !== 0) {
-    return { ok: false, error: `數量必須是 ${offer.inputPerBatch} 的倍數，且不可超過 ${method.capacity}` };
+  if (!count || count > method.capacity) {
+    return { ok: false, error: `數量不可超過 ${method.capacity}` };

-    const batches = Math.max(1, safeInt(shipment.quantity) / Math.max(1, safeInt(shipment.inputPerBatch, 1)));
+    const batches = safeInt(shipment.quantity) / Math.max(1, safeInt(shipment.inputPerBatch, 1));

# ---- src/app.js （updateIslandLogisticsQuote）----
-    quantityInput.min = String(selection.offer.inputPerBatch);
-    quantityInput.step = String(selection.offer.inputPerBatch);
+    quantityInput.min = 1;
+    quantityInput.step = 1;
     if (methodDefinition) quantityInput.max = String(methodDefinition.capacity);
-    const aligned = Math.max(selection.offer.inputPerBatch, Math.floor((Number(quantityInput.value) || selection.offer.inputPerBatch) / selection.offer.inputPerBatch) * selection.offer.inputPerBatch);
-    quantityInput.value = String(methodDefinition ? Math.min(aligned, methodDefinition.capacity) : aligned);
     selection.quantity = Number(quantityInput.value);

# ---- src/island/renderer.js ----
-  const offer = offers.find((entry) => availableInventoryQuantity(state, entry.itemId) >= entry.inputPerBatch) || offers[0];
   const method = methods[0];
-  const quantity = Math.max(1, offer?.inputPerBatch || 1);
+  const offer = offers.find((entry) => availableInventoryQuantity(state, entry.itemId) > 0) || offers[0];
+  const quantity = 1;

-  ... → ${escapeHtml(outputMarkup(entry.outputs))}</option>`
+  ... → ${recipeOutputsLabel(entry)}</option>`

# ---- src/island/catalog.js ----
# （ISLAND_TEST_MODE 測試期間曾改 true，收尾已還原 false，目前與 HEAD 一致、不在 diff）
```

---

## 6. 測試結果

### 6.1 純函數單元（`shipmentQuote`，boat 載量 20，`inputPerBatch=2`）
| 輸入 | 結果 |
|------|------|
| 1 | ✅ `ok:true, rewardCoins:5` |
| 2 | ✅ `ok:true, rewardCoins:10` |
| 3 | ✅ `ok:true, rewardCoins:15` |
| 25 | ❌ `ok:false, error:"數量不可超過 20"`（載量上限保留）✅ |

### 6.2 語法檢查
`node --check` 4 檔全過：`app.js` / `logistics.js` / `renderer.js` / `catalog.js` ✅

### 6.3 亂碼渲染驗證
真實 renderer 渲染加工設施選項 = 純文字、亂碼 0 處 ✅

### 6.4 主人手動 UI 驗證
主人回報：「**數量可送 1、可 key 任意數字**」「**加工設施亂碼消失**」「**整體看起來都正常了**」✅

---

## 7. ✅ Supabase 端 2 道倍數檢查已移除

前端與正式資料庫現在都允許 1 到載具容量的任意整數數量。正式庫已於 2026-08-15 套用：

`supabase/island-logistics-free-quantity-migration.sql`

位置：`supabase/island-logistics-migration.sql`

1. **`island_shipments` 表 CHECK 約束**
   ```sql
   quantity % input_per_batch = 0
   ```
2. **`dispatch_island_shipment` RPC 驗證**
   ```sql
   IF p_quantity % recipe.input_per_batch <> 0 THEN ... 拒絕
   ```

驗證結果：
- `island_shipments_check1` 不存在（`old_constraint_count = 0`）。
- `dispatch_island_shipment` 已無 `p_quantity % recipe.input_per_batch` 判斷。
- `anon`／`authenticated` 仍都有 RPC 執行權限。

---

## 8. 回滾方法（萬一有問題）

### 方法 A：整包回滾（最快）
```bash
cd D:\AI\SUDOX
# 只回滾本次 3 個檔案（catalog.js 已還原、不在 diff，不需處理）
git checkout -- src/app.js src/island/logistics.js src/island/renderer.js
```
> 注意：這會把**本次 + 同檔的其他未 commit 改動**一起還原。若這 3 檔內還有主人的其他未 commit 改動，請改用方法 B。

### 方法 B：只回滾本次邏輯（精確）
```bash
cd D:\AI\SUDOX
# 套用反向 diff（只含本次改動，含 v57→v58 版本號會一併回退）
git apply -R CHANGES_island-logistics-free-quantity.diff
```
> 若版本號行衝突（因其他改動已動過 import 行），就手動照第 3 節 before 段落逐處改回。

### 方法 C：手動逐處回滾
照第 3 節每個 `before` 代碼塊，把 `after` 改回 `before`。共 6 處邏輯（catalog.js 的 `ISLAND_TEST_MODE` 已還原、不需處理）。

---

## 9. COMMIT 前 Checklist

- [x] **還原 `src/island/catalog.js` 第 9 行 `ISLAND_TEST_MODE = false`**（✅ mimi 收尾已做，與 HEAD 一致）
- [x] 關閉 port 4174 測試 server（✅ 已關閉 `proc_891481e67a53`）
- [ ] 唯讀確認 port 4173 的 `sudox-progress-v3` 仍為 **3935 bytes**（主人真實進度未被影響）
- [x] 撰寫並執行 Supabase removal migration（第 7 節，正式庫已驗證）
- [x] `?v=v57`→`?v=v58` 版本號 bump 已完成
- [ ] 主人自行 `git commit`

> 建議 commit message：
> `feat(island): allow free shipment quantity (remove inputPerBatch multiple) + fix processing-facility option markup`

---

## 10. 驗證紀錄（mimi 實測）

| 時間 | 項目 | 結果 |
|------|------|------|
| 2026-08-15 | `node --check` × 4 檔 | 全過 |
| 2026-08-15 | `shipmentQuote` qty 1/2/3/25 | 1/2/3 過、25 被載量擋 |
| 2026-08-15 | renderer 加工設施選項渲染 | 純文字、無亂碼 |
| 2026-08-15 | 4173 HTTP（唯讀） | 200，未寫入 |
| 2026-08-15 | 主人手動 UI 驗證 | 數量 + 亂碼均正常 |

---

*mimi 整理 ・ 工作第一、紀錄清楚，主人要回滾或追問隨時喊我 (✪ω✪)*
