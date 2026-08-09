# 排行榜與層數交接／稽核

更新日期：2026-08-10
適用版本：v50 起

## 層數定義

- `game.floor`：這一局實際遊玩的層數，也是排行榜送出的「已完成層」。
- `progress.floors.easy|medium|hard|alin`：各模式下一個要玩的層數。
- 正常完成第 27 層後，排行榜是 27，對應的下一層是 28。
- 阿霖模式使用 `progress.floors.alin`；不得改動 easy／medium／hard。
- 開啟排行榜是唯讀操作，不得再以排行榜列直接改寫本機正式進度。

## 2026-08-10 問題與修正

已確認兩個來源：

1. 完成舊 session 時，舊程式用 `current + 1` 推進下一層。若排行榜／雲端已把下一層抬到 29，再完成第 27 層會錯跳 30。v50 改為 `max(既有下一層, 完成層 + 1)`。
2. 阿霖模式沿用所選正式難度的進度欄，會讓阿霖過關污染高手等正式層數。v50 新增獨立 `floors.alin`；舊存檔會依玩家自己的阿霖排行榜做一次性遷移。

離線佇列也改成先比較層數，只有同層才比較分數，避免低層高分覆蓋高層待送紀錄。

## 雲端歷史 LOG

Migration：`supabase/leaderboard-score-log-migration.sql`

Production project `riradorayjziystoalyj` 已於 2026-08-10 套用；驗證結果：LOG table／submit RPC／read RPC 皆存在、submit RPC 有 2 個向下相容 optional args、500 筆保留 guard 生效、RLS 開啟、anon 無 SELECT 權限、初始歷史列為 0。

`leaderboard_score_log` 每次經 PIN 驗證的排行榜送出都新增一列，不因主榜 upsert 被覆蓋。主要欄位：

- `submitted_floor`：客戶端送出的完成層。
- `submitted_next_floor`：完成當下本機記錄的下一層。
- `previous_floor`／`resulting_floor`：送出前與送出後主榜層數。
- `accepted`／`decision`：是否採用，以及 new row／higher floor／same-floor better score／not higher。
- `score`、`elapsed_seconds`、`mistakes`、`stars`。
- `app_version`、`created_at`。

為控制免費資料庫用量，每位玩家、每種模式保留最近 500 次送出；家庭規模下通常足以涵蓋很長時間，且不需要逐秒寫入。

表已開 RLS，anon／authenticated 無法直接讀取。玩家本人只能透過 `get_leaderboard_score_log(player_id, PIN, limit)` 讀取自己的最近紀錄；管理者可在 Supabase SQL Editor 查詢。

管理查詢範例：

```sql
select player_name, difficulty, submitted_floor, submitted_next_floor,
       previous_floor, resulting_floor, accepted, decision,
       app_version, created_at
from public.leaderboard_score_log
where lower(player_name) = lower('SUNNY')
order by created_at desc;
```

## 已知歷史資料邊界

LOG 建立前，`leaderboard_scores` 每位玩家／難度只保留最高一列，舊的 15、16、17 層若已被 18 覆蓋，資料庫無法回推。2026-08-10 唯讀稽核看到：

- 老爸：easy 28、medium 1、hard 3。
- SUNNY：easy 15、medium 10、hard 18、alin 17。

SUNNY 的 hard 15～17 沒有歷史表可查；`alin 17` 與 `hard 18` 的組合符合舊版阿霖模式污染正式難度的路徑，但這是由現有資料與程式缺陷作出的推論，不是歷史 LOG 證據。

既有錯誤主榜／雲端進度不可自動降低。修正特定玩家前，先由玩家確認最後真正完成的各模式層數，再同時處理：

1. `leaderboard_scores.floor` 與該列分數明細。
2. 玩家雲端存檔中的 `progress.floors`（值為下一層）。
3. 裝置上的本機存檔／舊 session，避免再次把錯值同步回雲端。
