import { readFileSync } from "node:fs";
import { countSolutions, createGame, DIFFICULTIES, generatePuzzle, isDifficultyPlayable, PLAYABLE_DIFFICULTIES, PUZZLES, relatedCells, solveSudoku } from "../src/game/sudoku.js";
import { activateAutomaticTreasures, ADVENTURE_RULES, applyHintTreasure, applyImmediateTreasure, candidatesFor, completedSudokuUnits, drawTreasureCards, newlyCompletedSudokuUnits, strongestEquippedRevive, sudokuUnitCells, treasureClaimsForFloor, treasurePool, TREASURE_AUTO_EFFECTS, TREASURE_CARDS, TREASURE_EFFECTS } from "../src/game/adventure.js";
import {
  applyAdventureSetup,
  applyPlayerDigit,
  collectBoardProgressEvents,
  collectNewMilestones,
  createAdventureGame,
  isValidRuntimeGame,
  normalizeRuntimeGame,
  normalizeSession,
  RUN_MILESTONES,
  settleCompletedGame
} from "../src/game/flow.js";
import { ACHIEVEMENTS, achievementValue, recordAchievementGame } from "../src/game/achievements.js";
import { chooseFriendPair, chooseGardenEel, choosePartyFriends, nextDanceVariants, FRIEND_ROSTER, friendPairKey, GARDEN_EEL_VARIANTS, DANCE_VARIANT_COUNT } from "../src/game/friends.js";
import { normalizePlayerName, validCloudPin } from "../src/state/cloud.js";
import { buildScore, leaderboardConfigured, normalizeLeaderboardTaunt } from "../src/state/leaderboard.js";
import { exportSaveCode, importSaveCode, mergeProgressHighWater, nextFloorFromCompleted, parseSaveCode, preferSaveSide, raiseFloorProgress, rewardProgress, saveProgress as writeProgress, saveTimestampMs, sessionFloorBehindProgress } from "../src/state/store.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const stylesheet = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const storeSource = readFileSync(new URL("../src/state/store.js", import.meta.url), "utf8");
const leaderboardSource = readFileSync(new URL("../src/state/leaderboard.js", import.meta.url), "utf8");
const leaderboardSql = readFileSync(new URL("../supabase/leaderboard.sql", import.meta.url), "utf8");
assert(FRIEND_ROSTER.length === 25 && FRIEND_ROSTER.some((friend) => friend.id === "otter"), "夥伴名單應包含 25 種動物與水獺");
assert(FRIEND_ROSTER.some((friend) => friend.id === "horse") && FRIEND_ROSTER.some((friend) => friend.id === "sheep"), "夥伴名單應包含馬與羊");
const firstFriendPair = chooseFriendPair("", () => 0);
const nextFriendPair = chooseFriendPair(firstFriendPair.key, () => 0);
assert(firstFriendPair.friends.length === 2 && new Set(firstFriendPair.friends.map((friend) => friend.id)).size === 2, "慶祝應選出兩位不同夥伴");
assert(nextFriendPair.key !== firstFriendPair.key, "同一組夥伴不應連續出現");
assert(friendPairKey([...firstFriendPair.friends].reverse()) === firstFriendPair.key, "夥伴配對鍵不應受站位順序影響");
const danceA = nextDanceVariants(0);
const danceB = nextDanceVariants(danceA.nextCursor);
assert(DANCE_VARIANT_COUNT === 4 && danceA.left === 1 && danceA.right === 2, "舞蹈變體應從 1、2 開始輪轉");
assert(danceB.left === 2 && danceB.right === 3, "舞蹈變體應持續輪番");
const party = choosePartyFriends("cat", 5, () => 0.1);
assert(party.length === 6 && party[0].id === "cat", "過關派對應為玩家 + 5 位好朋友");
assert(new Set(party.map((friend) => friend.id)).size === party.length, "過關派對成員不可重複");
assert(/friends-dance\/.*_\$\{|friendDanceUrl|friends-dance/.test(appSource), "事件慶祝應使用舞蹈動畫");
assert(/friendFaintUrl|friends-faint/.test(appSource), "失誤應使用專用昏倒動畫");
assert(/avatar-sticker|friends\/\$\{|friendStickerUrl/.test(appSource), "頭像應使用貼紙 PNG");
assert(/finale-firework|partyFriendsMarkup|choosePartyFriends/.test(appSource), "過關應有大合舞與煙火");
assert(/\.webp/.test(appSource) && /friendDanceUrl/.test(appSource), "好朋友舞蹈應為透明 WebP");
const orangeEel = chooseGardenEel(() => 0);
const whiteEel = chooseGardenEel(() => 0.999999);
assert(GARDEN_EEL_VARIANTS.length === 2 && orangeEel.cell === 0 && orangeEel.variant === "orange", "橘色花園鰻應可從第一格偷看");
assert(whiteEel.cell === 80 && whiteEel.variant === "white", "白色花園鰻應可從最後一格偷看");
const emptyOnly = chooseGardenEel(() => 0, { emptyCells: [14, 27, 63] });
assert(emptyOnly && emptyOnly.cell === 14, "花園鰻應優先選空白格");
assert(chooseGardenEel(() => 0, { emptyCells: [] }) === null, "沒有空白格時不應出現花園鰻");
assert(/emptyCells/.test(appSource), "探頭流程應只使用空白格");
assert(/grid-template-rows:\s*repeat\(9,\s*minmax\(0,\s*1fr\)\)/.test(stylesheet), "數獨盤面必須固定為 9 個可縮小橫列");
assert(/-webkit-text-size-adjust:\s*100%/.test(stylesheet), "iOS 內建瀏覽器不可自動放大文字而裁掉最下列");
assert(/garden-eel-peek/.test(stylesheet) && /@keyframes garden-eel-peek/.test(stylesheet), "花園鰻應有偷看動畫");
assert(/garden-eel-img/.test(appSource) && /garden-eel-img/.test(stylesheet), "花園鰻應使用圖片資源");
assert(/eel-orange\.webp/.test(appSource) && /eel-white\.webp/.test(appSource), "花園鰻探頭應使用雙色透明 WebP");
assert(/width:\s*11\.1112%/.test(stylesheet) && /height:\s*11\.1112%/.test(stylesheet), "花園鰻容器應約為一格大小");

assert(/player_avatar text/i.test(leaderboardSql) && /avatar_color integer/i.test(leaderboardSql), "leaderboard schema should include avatar columns");
assert(/p_player_avatar text/i.test(leaderboardSql) && /p_avatar_color integer/i.test(leaderboardSql), "leaderboard RPC should accept avatar parameters");
assert(/p_player_avatar/.test(leaderboardSource) && /p_avatar_color/.test(leaderboardSource), "score submission should include avatar parameters");
assert(/update_leaderboard_avatar/.test(leaderboardSource) && /update_leaderboard_avatar/.test(leaderboardSql), "avatar changes should sync to existing leaderboard rows");
assert(/p_pin text/.test(leaderboardSql) && /Invalid cloud PIN/.test(leaderboardSql), "leaderboard score submission must require a family PIN");
assert(/existing_hash <> extensions\.crypt\(p_pin, existing_hash\)/.test(leaderboardSql), "cloud save updates must verify the existing PIN");
assert(/pin_hash = excluded\.pin_hash/.test(leaderboardSql) === false, "cloud save updates must not overwrite pin_hash without auth");
assert(/loadCloudPin\(\)/.test(leaderboardSource) && /p_pin: pin/.test(leaderboardSource), "score upload should attach PIN at send time only");
assert(/sanitizeQueuedScore|p_pin/.test(leaderboardSource) && !/p_pin: progress/.test(leaderboardSource), "offline score queue should not embed PIN in buildScore payload");
const pinGuardSql = readFileSync(new URL("../supabase/pin-guard-migration.sql", import.meta.url), "utf8");
assert(/submit_leaderboard_score/.test(pinGuardSql) && /save_cloud_progress/.test(pinGuardSql), "existing projects need a PIN guard migration");
assert(/a-z_/.test(storeSource) && /Math\.min\(7/.test(storeSource), "avatar persistence should support avatar IDs and all eight colors");
assert(/hasLeaderboardRow \? row\.player_avatar : progress\.playerAvatar/.test(appSource), "leaderboard rows should use each player's own avatar");
assert(/leaderboard-placeholder/.test(appSource) && /avatar-placeholder-mark/.test(appSource), "leaderboard rows without avatars should keep a question-mark placeholder");
assert(/game-avatar-anchor/.test(appSource) && /board-stage/.test(appSource), "game avatar should be anchored above the board area");
assert(/grid-template-columns:\s*28px 34px minmax\(0, 1fr\) auto/.test(stylesheet), "leaderboard avatar column should keep a compact proportion");
assert(/max-width:\s*min\(11\.5em,\s*calc\(100% - 64px\)\)/.test(stylesheet), "avatar bubbles should stay within the board width without hard clipping");
assert(/game-avatar-anchor > \.player-avatar \{[\s\S]*flex-direction:\s*row/.test(stylesheet) && /game-avatar-anchor \.avatar-bubble \{[\s\S]*white-space:\s*nowrap/.test(stylesheet), "game avatar bubble should stay horizontal beside the avatar");
assert(/\.adventure-status \{[^}]*flex-direction:\s*column[^}]*align-items:\s*flex-start/.test(stylesheet), "desktop adventure status should use the mobile vertical layout");
assert(appSource.indexOf('<div class="adventure-status">') < appSource.indexOf('${avatarMarkup()}') && appSource.indexOf('${avatarMarkup()}') < appSource.indexOf('<div class="board-stage">'), "game avatar should use the open status area");
assert(/game-avatar-anchor \.avatar-sticker \{[\s\S]*width:\s*58px/.test(stylesheet) && /game-avatar-anchor \.avatar-bubble \{[\s\S]*overflow:\s*visible/.test(stylesheet), "game avatar sticker should be larger and bubble must not be clipped");
assert(/boardBuddiesMarkup|board-buddy-img|pickBoardBuddies/.test(appSource), "盤面三好友應使用隨機靜態貼紙");
assert(/board-buddies \{[\s\S]*top:\s*-26px[\s\S]*left:\s*18px/.test(stylesheet), "三好友應站在白卡片左上框線");
assert(/margin-right:\s*-10px/.test(stylesheet), "三好友應互相靠近像一起出遊");
assert(/board-card[\s\S]*boardBuddiesMarkup|\$\{boardBuddiesMarkup\(\)\}[\s\S]*game-meta/.test(appSource), "三好友應掛在 board-card 上緣而非數獨格線");
assert(/\.board-buddies \{[\s\S]*top:\s*-22px[\s\S]*left:\s*12px/.test(stylesheet), "手機版三好友仍靠卡片左上");
assert(/\.adventure-status \.game-avatar-anchor \{[\s\S]*position: relative;[\s\S]*justify-content: flex-end;/.test(stylesheet), "mobile game avatar should have its own non-overlapping row");
assert(/adventure-status \.avatar-sticker \{ width: 48px/.test(stylesheet), "mobile avatar should grow modestly without dominating the status row");
assert(/\.topbar \{ height: auto; min-height: 48px; flex-wrap: wrap;/.test(stylesheet) && /\.topbar-actions \{ flex: 1 0 100%;[^}]*width: 100%;/.test(stylesheet), "mobile topbar actions should use a separate row");
assert(/if \(!progress\.playerAvatar\) \{\s*showAvatarPicker = true/.test(appSource), "a new game should require an avatar selection");
assert(appSource.indexOf('<div class="number-pad"') < appSource.indexOf('<div class="tools">'), "number pad should sit immediately before the tool buttons");
assert(/\.notes i \{[^}]*font-size:\s*clamp\(7px, 1\.2vw, 10px\)/.test(stylesheet) && /\.notes i \{ font-size: clamp\(8px, 2\.5vw, 10px\); \}/.test(stylesheet), "note digits should be larger on desktop and mobile");
assert(/from "\.\/game\/flow\.js"/.test(appSource) && /applyPlayerDigit|settleCompletedGame/.test(appSource), "app 應透過 flow 模組處理填格與完局規則");
assert(/createAdventureGame/.test(appSource) && !/createGame\(/.test(appSource), "app 應以 createAdventureGame 建立完整局，不再直接 createGame");
assert(/normalizeSession/.test(storeSource), "session 載入應走完整 runtime 正規化");
assert(/src\/game\/flow\.js/.test(readFileSync(new URL("../sw.js", import.meta.url), "utf8")), "Service Worker 應快取 flow 模組");
assert(RUN_MILESTONES.length >= 5, "本局里程碑規則應集中在 flow 模組");
const factoryGame = createAdventureGame({ difficulty: "medium", floor: 4, equippedCards: ["shield", "revive", "extra"] });
assert(factoryGame.difficulty === "medium" && factoryGame.floor === 4, "工廠應套用難度與樓層");
assert(factoryGame.maxHealth === ADVENTURE_RULES.medium.maxHealth && factoryGame.health === factoryGame.maxHealth, "工廠應一次帶入冒險血量");
assert(factoryGame.equippedCards.length === 2 && factoryGame.healGoals && Array.isArray(factoryGame.milestones), "工廠應帶入裝備與目標結構");
assert(isValidRuntimeGame(factoryGame), "工廠產出必須通過 runtime 驗證");
assert(normalizeRuntimeGame({ difficulty: "easy" }) === null, "缺盤面的物件不可通過 runtime 驗證");
const legacyPartial = { ...createGame("hard"), floor: 2 };
const normalizedLegacy = normalizeRuntimeGame(legacyPartial);
assert(normalizedLegacy && normalizedLegacy.maxHealth === ADVENTURE_RULES.hard.maxHealth && normalizedLegacy.floor === 2, "僅有盤面的舊局應能正規化成完整 runtime");
assert(normalizedLegacy.healGoals && Array.isArray(normalizedLegacy.completedUnits.rows), "正規化應補齊冒險欄位");
assert(normalizeSession({ game: { ...factoryGame, completed: true }, alinMode: false }) === null, "已完局 session 不可繼續遊玩");
assert(normalizeSession({ game: factoryGame, equippedCards: ["shield"], alinMode: true })?.alinMode === true, "合法 session 應正規化成功");
assert(normalizeSession({ game: { ...createGame("easy"), floor: 1, completed: false, failed: false }, equippedCards: [], alinMode: false })?.game.maxHealth === ADVENTURE_RULES.easy.maxHealth, "載入 session 時應補齊血量等欄位");
assert(PLAYABLE_DIFFICULTIES.join(",") === "easy,medium,hard", "三種難度皆應列為可遊玩");
assert(isDifficultyPlayable("easy") && isDifficultyPlayable("medium") && isDifficultyPlayable("hard"), "輕鬆／動腦／高手從一開始即可遊玩");
assert(!isDifficultyPlayable("expert"), "未知難度不可標記為可遊玩");
assert(!/unlockedDifficulty\s*=/.test(storeSource) && !/completedGames >= 2/.test(storeSource), "進度不應再寫入難度解鎖欄位");
assert(!/unlockedDifficulty/.test(appSource), "UI 不應依賴已廢棄的 unlockedDifficulty");
assert(/let cloudHydrationPending = cloudConfigured\(\) && Boolean\(progress\.playerName\) && validCloudPin\(loadCloudPin\(\)\)/.test(appSource), "cloud progress hydration should start when local cloud credentials exist");
assert(/function scheduleCloudSync\(\) \{\s*if \(cloudHydrationPending\) return;/.test(appSource), "startup cloud hydration should block automatic upload until finished");
assert(/parseSaveCode\(saveCode\)/.test(appSource) && /preferSaveSide\(/.test(appSource), "cloud hydration should compare local and cloud saves before writing");
assert(/importSaveCode\(saveCode, \{ touch: false \}\)/.test(appSource), "cloud hydration should preserve cloud updatedAt when cloud wins");
assert(/winner === "cloud"/.test(appSource) && /scheduleCloudSync\(\)/.test(appSource), "cloud hydration should keep newer local progress and sync upward");

function validSolution(solution) {
  const target = "123456789";
  const line = (values) => [...values].sort().join("") === target;
  for (let index = 0; index < 9; index += 1) {
    const row = solution.slice(index * 9, index * 9 + 9);
    const column = Array.from({ length: 9 }, (_, rowIndex) => solution[rowIndex * 9 + index]);
    if (!line(row) || !line(column)) return false;
  }
  return true;
}

function solveWithSingles(puzzle) {
  const values = [...puzzle];
  const units = [];
  for (let row = 0; row < 9; row += 1) units.push(Array.from({ length: 9 }, (_, col) => row * 9 + col));
  for (let col = 0; col < 9; col += 1) units.push(Array.from({ length: 9 }, (_, row) => row * 9 + col));
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxCol = 0; boxCol < 3; boxCol += 1) {
      units.push(Array.from({ length: 9 }, (_, offset) => (boxRow * 3 + Math.floor(offset / 3)) * 9 + boxCol * 3 + (offset % 3)));
    }
  }
  while (values.includes(0)) {
    let move = values.findIndex((value, index) => !value && candidatesFor(values, index).length === 1);
    if (move >= 0) {
      values[move] = candidatesFor(values, move)[0];
      continue;
    }
    let placed = false;
    for (const unit of units) {
      for (let number = 1; number <= 9; number += 1) {
        const spots = unit.filter((index) => !values[index] && candidatesFor(values, index).includes(number));
        if (spots.length === 1) {
          values[spots[0]] = number;
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) return false;
  }
  return validSolution(values);
}

for (const difficulty of Object.keys(DIFFICULTIES)) {
  for (const puzzleText of PUZZLES[difficulty]) {
    const puzzle = puzzleText.split("").map(Number);
    const solution = solveSudoku(puzzle);
    assert(puzzle.length === 81, `${difficulty} 盤面必須有 81 格`);
    assert(puzzle.some((value) => value === 0), `${difficulty} 題目必須包含空格`);
    assert(validSolution(solution), `${difficulty} 解答不符合數獨規則`);
    assert(countSolutions(puzzle) === 1, `${difficulty} 題目必須只有唯一解`);
    puzzle.forEach((value, index) => {
      assert(!value || value === solution[index], `${difficulty} 題目與解答不一致`);
    });
    if (difficulty === "easy") {
      const rowBlanks = Array.from({ length: 9 }, (_, row) => puzzle.slice(row * 9, row * 9 + 9).filter((value) => value === 0).length);
      const colBlanks = Array.from({ length: 9 }, (_, col) => Array.from({ length: 9 }, (_, row) => puzzle[row * 9 + col]).filter((value) => value === 0).length);
      assert(rowBlanks.every((count) => count <= 4), "輕鬆題每行最多只能有 4 個空格");
      assert(colBlanks.every((count) => count <= 4), "輕鬆題每列最多只能有 4 個空格");
      assert(solveWithSingles(puzzle), "輕鬆題必須能只靠裸單與隱單完成");
    }
  }
  const game = createGame(difficulty);
  assert(game.difficulty === difficulty, `${difficulty} 應建立對應難度遊戲`);
  assert(countSolutions(game.puzzle) === 1, `${difficulty} 即時生成題必須只有唯一解`);
  assert(validSolution(game.solution), `${difficulty} 即時生成解答必須有效`);
}

const generatedFingerprints = new Set(Array.from({ length: 3 }, () => generatePuzzle("medium").puzzle.join("")));
assert(generatedFingerprints.size === 3, "連續生成的關卡不應重複");

assert(solveSudoku(Array(81).fill(0)).every(Boolean), "解題器應可完成空盤面");
assert(relatedCells(40).size === 21, "中央格應包含 21 個同行、同列與同宮格子");
assert(ADVENTURE_RULES.easy.maxHealth > ADVENTURE_RULES.medium.maxHealth, "輕鬆難度血量應高於動腦");
assert(ADVENTURE_RULES.medium.maxHealth > ADVENTURE_RULES.hard.maxHealth, "動腦難度血量應高於高手");
assert(Object.keys(TREASURE_CARDS).length === 60, "寶物圖鑑應提供 60 種寶物");
assert(Object.values(TREASURE_CARDS).every((card) => TREASURE_EFFECTS.includes(card.effect)), "每張寶物都必須使用遊戲支援的效果");
assert(Object.values(TREASURE_CARDS).every((card) => Number.isFinite(card.value) && card.value > 0), "每張寶物的效果數值都必須有效");
assert(TREASURE_AUTO_EFFECTS.every((effect) => TREASURE_EFFECTS.includes(effect)), "自動生效寶物必須使用遊戲支援的效果");
assert(treasurePool("easy").length === 10, "輕鬆難度應使用前 10 種寶物");
assert(treasurePool("medium").length === 30, "動腦難度應使用前 30 種寶物");
assert(treasurePool("hard").length === 60, "高手難度應使用完整 60 種寶物");
assert(new Set(drawTreasureCards("hard", 3)).size === 3, "抽卡選項不可重複");
const completedUnitGame = createGame("easy");
assert(completedSudokuUnits(completedUnitGame.solution).rows.length === 9, "完成盤面應辨識 9 行");
assert(completedSudokuUnits(completedUnitGame.solution).columns.length === 9, "完成盤面應辨識 9 直列");
assert(completedSudokuUnits(completedUnitGame.solution).boxes.length === 9, "完成盤面應辨識 9 宮");
const almostCompleteValues = [...completedUnitGame.solution];
almostCompleteValues[0] = 0;
assert(!completedSudokuUnits(almostCompleteValues).rows.includes(0), "缺一格的行不可觸發完成特效");
assert(!completedSudokuUnits(almostCompleteValues).columns.includes(0), "缺一格的直列不可觸發完成特效");
assert(!completedSudokuUnits(almostCompleteValues).boxes.includes(0), "缺一格的宮不可觸發完成特效");
const laterUnits = newlyCompletedSudokuUnits(completedUnitGame.solution, { rows: [0], columns: [0], boxes: [0] });
assert(laterUnits.rows.length === 8 && !laterUnits.rows.includes(0), "已跳過波浪舞的行不可重複觸發");
assert(laterUnits.columns.length === 8 && !laterUnits.columns.includes(0), "已跳過波浪舞的直列不可重複觸發");
assert(laterUnits.boxes.length === 8 && !laterUnits.boxes.includes(0), "已跳過波浪舞的宮不可重複觸發");
assert(sudokuUnitCells("row", 2).join(",") === "18,19,20,21,22,23,24,25,26", "行波浪應依左到右排列 9 格");
assert(sudokuUnitCells("column", 2).join(",") === "2,11,20,29,38,47,56,65,74", "直列波浪應依上到下排列 9 格");
assert(sudokuUnitCells("box", 4).join(",") === "30,31,32,39,40,41,48,49,50", "宮波浪應依宮內順序排列 9 格");
assert(sudokuUnitCells("row", 2, 1).join(",") === "26,25,24,23,22,21,20,19,18", "行動畫第二型應由右到左排列 9 格");
assert(sudokuUnitCells("column", 2, 1).join(",") === "74,65,56,47,38,29,20,11,2", "直列動畫第二型應由下到上排列 9 格");
assert(sudokuUnitCells("box", 4, 1).join(",") === "30,31,32,41,50,49,48,39,40", "宮動畫第二型應沿外圈螺旋進入中心");
assert(strongestEquippedRevive(["revive"], { revive: 1 }) === "revive", "已裝備的復活寶物應可在失敗時使用");
assert(!strongestEquippedRevive([], { revive: 1 }), "未裝備的復活寶物不可在本關使用");
assert(strongestEquippedRevive(["revive", "phoenixCrown"], { revive: 1, phoenixCrown: 1 }) === "phoenixCrown", "同時裝備復活寶物時應優先使用效果較強者");

const effectGame = {
  health: 2, maxHealth: 5, shields: 0, values: Array(81).fill(0), notes: Array.from({ length: 81 }, () => []),
  selected: 40, frozenSeconds: 0, xpMultiplier: 1, extraCardClaims: 0
};
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.twinHeart) && effectGame.health === 4, "回血寶物應依數值回復且不超過上限");
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.ironWall) && effectGame.shields === 2, "護盾寶物應增加正確層數");
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.candidateLens) && effectGame.notes[40].length === 9, "候選寶物應為空格標出合法候選數字");
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.hourglass) && effectGame.frozenSeconds === 60, "計時寶物應增加凍結秒數");
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.luckyStar) && effectGame.xpMultiplier === 2, "經驗寶物應套用正確倍率");
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.goldKey) && effectGame.extraCardClaims === 2, "鑰匙寶物應增加正確抽卡數");
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.cometBadge) && effectGame.xpMultiplier === 4, "不同經驗寶物應可累加生效");
assert(applyImmediateTreasure(effectGame, TREASURE_CARDS.silverKey) && effectGame.extraCardClaims === 3, "不同鑰匙寶物應可累加選卡次數");
assert(treasureClaimsForFloor(1, effectGame.extraCardClaims) === 4, "第一層使用鑰匙後應包含基本掉落與額外選卡");
assert(treasureClaimsForFloor(2, effectGame.extraCardClaims) === 3, "一般探索層使用鑰匙仍應取得額外選卡");

const automaticGame = { xpMultiplier: 1, extraCardClaims: 0, usedCards: [] };
const automaticallyActivated = activateAutomaticTreasures(
  automaticGame,
  ["treasureKey", "luckyStar"],
  { treasureKey: 1, luckyStar: 1 }
);
assert(automaticallyActivated.length === 2 && automaticGame.usedCards.length === 2, "開局時應自動啟動所有已裝備的被動寶物");
assert(automaticGame.extraCardClaims === 1 && treasureClaimsForFloor(1, automaticGame.extraCardClaims) === 2, "寶物鑰匙應讓第一層可選兩張寶物");
assert(automaticGame.xpMultiplier === 2, "經驗寶物應在開局時自動生效");
assert(activateAutomaticTreasures(automaticGame, ["treasureKey"], { treasureKey: 1 }).length === 0, "同一張被動寶物每局只能啟動一次");

for (const [cardId, card] of Object.entries(TREASURE_CARDS)) {
  const catalogGame = createGame("easy");
  Object.assign(catalogGame, {
    health: 1,
    maxHealth: 10,
    shields: 0,
    frozenSeconds: 0,
    xpMultiplier: 1,
    extraCardClaims: 0
  });
  const selected = catalogGame.values.findIndex((value) => value === 0);
  catalogGame.selected = selected;
  if (card.effect === "hint") {
    const targets = applyHintTreasure(catalogGame, card, selected);
    assert(targets.length === card.value && targets.every((index) => catalogGame.values[index] === catalogGame.solution[index]), `${cardId} 必須填入正確答案`);
  } else if (card.effect === "revive") {
    assert(strongestEquippedRevive([cardId], { [cardId]: 1 }) === cardId, `${cardId} 必須可被復活流程辨識`);
  } else {
    assert(applyImmediateTreasure(catalogGame, card, { index: selected }), `${cardId} 必須可成功套用效果`);
    if (card.effect === "heal") assert(catalogGame.health === Math.min(10, 1 + card.value), `${cardId} 回血量必須正確`);
    if (card.effect === "shield") assert(catalogGame.shields === card.value, `${cardId} 護盾量必須正確`);
    if (card.effect === "candidates") assert(catalogGame.notes[selected].length > 0, `${cardId} 必須標示候選數字`);
    if (card.effect === "freeze") assert(catalogGame.frozenSeconds === card.value, `${cardId} 凍結秒數必須正確`);
    if (card.effect === "xpBoost") assert(catalogGame.xpMultiplier === card.value, `${cardId} XP 倍率必須正確`);
    if (card.effect === "extraClaim") assert(treasureClaimsForFloor(2, catalogGame.extraCardClaims) === card.value, `${cardId} 必須增加選卡次數`);
  }
}

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key)
};
const saveProgress = { playerId: "5e2b1c42-fc62-4f58-9f01-29ded0bab4d2", playerName: "阿霖", level: 7, xp: 42, coins: 88, floors: { easy: 9, medium: 4, hard: 2 }, inventory: { dragonElixir: 1 }, cardCollection: ["dragonElixir"], updatedAt: "2026-01-01T00:00:00.000Z" };
const saveSession = { game: createAdventureGame({ difficulty: "easy", floor: 9, equippedCards: ["dragonElixir"] }), equippedCards: ["dragonElixir"], alinMode: false };
const saveCode = exportSaveCode(saveProgress, saveSession);
const parsedOnly = parseSaveCode(saveCode);
assert(parsedOnly.progress.level === 7 && memory.size === 0, "parseSaveCode 不可寫入 localStorage");
assert(parsedOnly.exportedAt === "2026-01-01T00:00:00.000Z", "存檔碼應保留 updatedAt 作為 exportedAt");
const imported = importSaveCode(saveCode, { touch: false });
assert(imported.progress.level === 7 && imported.progress.floors.easy === 9, "存檔碼應還原等級與層數");
assert(imported.progress.playerName === "阿霖" && imported.progress.playerId === saveProgress.playerId, "存檔碼應還原玩家名稱與匿名 ID");
assert(imported.session.game.floor === 9 && imported.session.equippedCards[0] === "dragonElixir", "存檔碼應還原目前關卡與裝備");
assert(imported.progress.updatedAt === "2026-01-01T00:00:00.000Z", "touch:false 應保留原存檔時間戳");
assert(preferSaveSide(
  { ...imported.progress, updatedAt: "2026-02-01T00:00:00.000Z", completedGames: 3 },
  { ...imported.progress, updatedAt: "2026-01-01T00:00:00.000Z", completedGames: 9 }
) === "local", "較新的本機進度必須勝過較舊的雲端進度");
assert(preferSaveSide(
  { ...imported.progress, updatedAt: "2026-01-01T00:00:00.000Z", completedGames: 9 },
  { ...imported.progress, updatedAt: "2026-02-01T00:00:00.000Z", completedGames: 3 }
) === "cloud", "較新的雲端進度應覆蓋較舊的本機進度");
assert(preferSaveSide(
  { completedGames: 1, totalStars: 1, level: 1, floors: { easy: 1, medium: 1, hard: 1 } },
  { completedGames: 5, totalStars: 10, level: 4, floors: { easy: 6, medium: 2, hard: 1 } },
  { localHasSession: true, cloudHasSession: false }
) === "local", "缺時間戳時，進行中的本機關卡不可被雲端靜默覆蓋");
assert(preferSaveSide(
  { completedGames: 1, totalStars: 0, level: 1, floors: { easy: 1, medium: 1, hard: 1 } },
  { completedGames: 8, totalStars: 20, level: 5, floors: { easy: 9, medium: 3, hard: 2 } },
  { localHasSession: false, cloudHasSession: false }
) === "cloud", "缺時間戳且無進行中關卡時，可依進度內容採用較完整的雲端存檔");
assert(saveTimestampMs({ updatedAt: "2026-03-01T12:00:00.000Z" }) > 0, "saveTimestampMs 應解析 ISO 時間");
writeProgress({ ...imported.progress, coins: 99 }, { touch: true });
assert(saveTimestampMs(JSON.parse(memory.get("sudox-progress-v3"))) > Date.parse("2026-01-01T00:00:00.000Z"), "saveProgress 預設應更新 updatedAt");
const legacyUnlockSave = exportSaveCode({
  ...imported.progress,
  unlockedDifficulty: "easy",
  completedGames: 0,
  updatedAt: "2026-04-01T00:00:00.000Z"
}, null);
const strippedUnlock = importSaveCode(legacyUnlockSave, { touch: false });
assert(!("unlockedDifficulty" in strippedUnlock.progress), "載入舊存檔應移除 unlockedDifficulty");
const afterRewards = rewardProgress(strippedUnlock.progress, 35, 0, 1, "hard");
assert(afterRewards.completedGames === 1 && !("unlockedDifficulty" in afterRewards), "完賽獎勵不應再建立難度解鎖狀態");
assert(afterRewards.floors.hard >= 2, "高手難度從第一局即可推進樓層");
assert(nextFloorFromCompleted(16) === 17, "排行榜已完成樓層應對應下一層 = 完成層 + 1");
assert(raiseFloorProgress({ floors: { easy: 15, medium: 1, hard: 1 } }, "easy", 17).floors.easy === 17, "本機樓層落後時應被抬高");
assert(raiseFloorProgress({ floors: { easy: 18, medium: 1, hard: 1 } }, "easy", 17).floors.easy === 18, "本機已較高時不可被排行榜拉低");
assert(sessionFloorBehindProgress({ floors: { easy: 15, medium: 1, hard: 1 } }, { difficulty: "easy", floor: 12 }), "落後的中途局應被辨識為低於正式下一層");
assert(!sessionFloorBehindProgress({ floors: { easy: 15, medium: 1, hard: 1 } }, { difficulty: "easy", floor: 15 }), "中途局已在正式下一層時不可被重置");
assert(!sessionFloorBehindProgress({ floors: { easy: 15, medium: 1, hard: 1 } }, { difficulty: "alin", floor: 12 }), "阿霖模式不應污染三種正式樓層紀錄");
const mergedFloors = mergeProgressHighWater(
  { floors: { easy: 12, medium: 2, hard: 1 }, completedGames: 4, totalStars: 8, level: 3, coins: 10 },
  { floors: { easy: 16, medium: 1, hard: 4 }, completedGames: 2, totalStars: 20, level: 2, coins: 40 }
);
assert(mergedFloors.floors.easy === 16 && mergedFloors.floors.hard === 4, "合併存檔應取各難度最高樓層");
assert(mergedFloors.completedGames === 4 && mergedFloors.totalStars === 20 && mergedFloors.coins === 40, "合併存檔應取生命週期計數高水位");
const catchUp = rewardProgress({ floors: { easy: 15, medium: 1, hard: 1 }, completedGames: 0, xp: 0, level: 1, coins: 0, streak: 0, totalStars: 0 }, 10, 0, 1, "easy", 16);
assert(catchUp.floors.easy === 17, "完賽時若局內樓層高於存檔計數，下一層應對齊 completed+1");
assert(/mergeProgressHighWater|raiseFloorProgress|reconcileFloorsFromLeaderboardRows/.test(appSource), "雲端與排行榜應能抬高落後的本機樓層");

assert(/sessionFloorBehindProgress/.test(appSource) && /reconcileActiveSessionFloor/.test(appSource), "雲端抬高樓層後應重置落後的中途局");
const flowGame = createAdventureGame({ difficulty: "easy", floor: 1 });
flowGame.started = true;
flowGame.health = 2;
flowGame.shields = 1;
const emptyCell = flowGame.values.findIndex((value, index) => !value && !flowGame.puzzle[index]);
flowGame.selected = emptyCell;
const wrongDigit = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((digit) => digit !== flowGame.solution[emptyCell]);
const mistake = applyPlayerDigit(flowGame, wrongDigit, { alinMode: false });
assert(mistake.type === "mistake" && mistake.blockedByShield && flowGame.health === 2 && flowGame.shields === 0, "錯誤答案應先消耗護盾");
const secondMistake = applyPlayerDigit(flowGame, wrongDigit, { alinMode: false });
assert(secondMistake.type === "mistake" && !secondMistake.blockedByShield && flowGame.health === 1, "無護盾時錯誤應扣血");
const correct = applyPlayerDigit(flowGame, flowGame.solution[emptyCell], { alinMode: false });
assert(correct.type === "correct" && flowGame.values[emptyCell] === flowGame.solution[emptyCell], "正確答案應寫入盤面");
flowGame.correctStreak = 8;
const progressEvents = collectBoardProgressEvents(flowGame, false);
assert(progressEvents.events.some((event) => event.kind === "healGoal" && event.goal === "streak"), "連對 8 格應產生回血事件");
assert(flowGame.healGoals.streak === true, "連對目標標記應由 flow 更新");
flowGame.values = [...flowGame.solution];
flowGame.elapsed = 30;
flowGame.mistakes = 0;
flowGame.hintsUsed = 0;
flowGame.xpMultiplier = 1;
const settlement = settleCompletedGame(flowGame, { alinMode: false });
assert(settlement && settlement.stars === 3 && settlement.xpReward >= 10 && flowGame.completed, "完局結算應計算星級與 XP");
assert(settleCompletedGame(flowGame, { alinMode: false }) === null, "已完局不可重複結算");
flowGame.completed = false;
flowGame.values = [...flowGame.solution];
flowGame.values[emptyCell] = 0;
flowGame.completedUnits = completedSudokuUnits(flowGame.values);
flowGame.milestones = [];
flowGame.correctStreak = 15;
const milestones = collectNewMilestones(flowGame);
assert(milestones.some((item) => item.id === "streak15"), "里程碑規則應可獨立測試");

assert(validCloudPin("0428") && !validCloudPin("123") && !validCloudPin("12a4"), "家庭 PIN 必須是 4 位數字");
assert(normalizePlayerName("  新阿霖\n") === "新阿霖" && normalizePlayerName("島".repeat(20)).length === 16, "雲端玩家名稱應清理控制字元並限制為 16 字");
assert(leaderboardConfigured(), "Supabase 專案設定後排行榜應啟用雲端模式");
const score = buildScore(imported.progress, { difficulty: "easy", floor: 9, stars: 3, elapsed: 120, mistakes: 0 });
assert(score.p_player_name === "阿霖" && score.p_floor === 9 && score.p_score > 90000, "排行榜成績應包含玩家、層數與計算分數");
assert(!("p_pin" in score), "成績佇列物件不可內嵌家庭 PIN");
assert(buildScore(imported.progress, { difficulty: "hard", floor: 3, stars: 2, elapsed: 300, mistakes: 4 }, true).p_difficulty === "alin", "阿霖模式成績應送往獨立排行榜");
assert(normalizeLeaderboardTaunt("  榜首是我的！\n  ") === "榜首是我的！", "排行榜嗆聲應移除控制字元與前後空白");
assert(normalizeLeaderboardTaunt("哈".repeat(60)).length === 48, "排行榜嗆聲應限制為 48 字");
assert(/p_difficulty/.test(leaderboardSource) && /update_leaderboard_taunt/.test(leaderboardSource), "嗆聲更新 API 應帶上難度");
assert(/p_difficulty text/.test(leaderboardSql) && /and difficulty = p_difficulty/.test(leaderboardSql), "DB 嗆聲更新應只寫入對應難度列");
assert(!/set taunt = trim\(p_taunt\)\s*where player_id = p_player_id;\s*end;/.test(leaderboardSql), "嗆聲不可再一次寫入該玩家所有難度");
assert(/difficulty: leaderboardDifficulty|p_difficulty: difficulty/.test(appSource), "前端送出嗆聲應使用目前排行榜分頁難度");
assert(/只套用在|嗆聲也依難度分開/.test(appSource), "UI 應提示嗆聲依難度分開");
const achievementRun = recordAchievementGame({ ...imported.progress, completedGames: 5, totalStars: 20, coins: 0, achievements: [], achievementStats: {} }, { perfect: true, speed: true, alin: true });
assert(achievementRun.unlocked.some((item) => item.id === "fiveClears") && achievementRun.unlocked.some((item) => item.id === "starCollector"), "累計局數與星星應解鎖永久成就");
assert(achievementRun.progress.achievementStats.perfectGames === 1 && achievementRun.progress.coins > 0, "完賽統計與成就金幣應永久累積");
assert(recordAchievementGame(achievementRun.progress).unlocked.length === 0, "已解鎖成就不可重複領取");
assert(achievementValue(achievementRun.progress, ACHIEVEMENTS.find((item) => item.id === "firstPerfect")) === 1, "成就圖鑑應顯示正確進度");
console.log("核心規則測試通過");
