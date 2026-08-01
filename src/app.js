import { createGame, DIFFICULTIES, relatedCells } from "./game/sudoku.js";
import { activateAutomaticTreasures, ADVENTURE_RULES, applyHintTreasure, applyImmediateTreasure, calculateStars, completedSudokuUnits, drawTreasureCards, newlyCompletedSudokuUnits, strongestEquippedRevive, sudokuUnitCells, treasureClaimsForFloor, TREASURE_AUTO_EFFECTS, TREASURE_CARDS } from "./game/adventure.js";
import { cloudConfigured, loadCloudPin, loadCloudProgress, saveCloudPin, saveCloudProgress, validCloudPin } from "./state/cloud.js";
import { buildScore, fetchLeaderboard, flushPendingScores, leaderboardConfigured, pendingScoreCount, queueLeaderboardScore } from "./state/leaderboard.js";
import { addCard, clearSession, consumeCard, exportSaveCode, importSaveCode, loadProgress, loadSession, rewardProgress, saveProgress, saveSession, spendCoins } from "./state/store.js";

const app = document.querySelector("#app");
let progress = loadProgress();
const restoredSession = loadSession();
let game = restoredSession?.game || createGame("easy");
if (restoredSession && typeof game.started !== "boolean") game.started = true;
if (restoredSession && !game.completedUnits) game.completedUnits = completedSudokuUnits(game.values);
let noteMode = false;
let alinMode = restoredSession?.alinMode || false;
let showBackpack = false;
let showSaveCenter = false;
let showNameSetup = !progress.playerName;
let showLeaderboard = false;
let leaderboardDifficulty = game.difficulty;
let leaderboardRows = [];
let leaderboardStatus = "";
let nameSetupStatus = "";
let cloudSyncStatus = "";
let cloudSyncTimer;
let equippedCards = restoredSession?.equippedCards || [];
let timerId;
let celebrationId = 0;
let gameEffectQueue = [];
let gameEffectActive = false;
let cellWaveQueue = [];
let cellWaveActive = false;

const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const currentHintCost = () => alinMode ? 0 : DIFFICULTIES[game.difficulty].hintCost;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const normalizePinInput = (value) => String(value)
  .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xFF10))
  .replace(/\D/g, "")
  .slice(0, 4);

function mascot() {
  return `<div class="mascot" aria-hidden="true"><span class="ear left"></span><span class="ear right"></span><span class="face">•ᴗ•</span></div>`;
}

function showCelebration(icon, title, detail) {
  let stack = document.querySelector("#celebration-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "celebration-stack";
    stack.className = "celebration-stack";
    stack.setAttribute("aria-live", "polite");
    stack.setAttribute("aria-atomic", "false");
    document.body.append(stack);
  }

  const toast = document.createElement("section");
  toast.className = "celebration-toast";
  toast.dataset.celebrationId = String(++celebrationId);
  toast.innerHTML = `<span class="celebration-icon" aria-hidden="true">${icon}</span><span><strong>${title}</strong><small>${detail}</small></span>`;
  stack.append(toast);
  setTimeout(() => {
    toast.classList.add("leaving");
    toast.addEventListener("animationend", () => {
      toast.remove();
      if (!stack.children.length) stack.remove();
    }, { once: true });
  }, 2600);
}

function showGameEffect(icon, title, detail, tone = "success") {
  gameEffectQueue.push({ icon, title, detail, tone });
  playNextGameEffect();
}

function playNextGameEffect() {
  if (gameEffectActive || !gameEffectQueue.length) return;
  gameEffectActive = true;
  const { icon, title, detail, tone } = gameEffectQueue.shift();
  const effect = document.createElement("section");
  effect.className = `game-effect ${tone}`;
  effect.setAttribute("role", "status");
  effect.setAttribute("aria-live", "polite");
  effect.innerHTML = `
    <span class="effect-spark one">✦</span><span class="effect-spark two">●</span><span class="effect-spark three">✦</span>
    <div class="effect-character" aria-hidden="true">${icon}</div>
    <div class="effect-bubble"><strong>${title}</strong><small>${detail}</small></div>
    <span class="effect-spark four">●</span><span class="effect-spark five">✦</span>`;
  document.body.append(effect);
  document.body.classList.remove("flash-success", "flash-mistake", "flash-shield", "flash-card");
  document.body.classList.add(`flash-${tone}`);
  setTimeout(() => document.body.classList.remove(`flash-${tone}`), 780);
  setTimeout(() => {
    effect.remove();
    gameEffectActive = false;
    playNextGameEffect();
  }, 1750);
}

function queueCellWave(type, unitIndex) {
  cellWaveQueue.push({ type, cells: sudokuUnitCells(type, unitIndex) });
}

function playNextCellWave() {
  if (cellWaveActive || !cellWaveQueue.length) return;
  const wave = cellWaveQueue.shift();
  const cells = wave.cells.map((index) => document.querySelector(`[data-cell="${index}"]`)).filter(Boolean);
  if (!cells.length) {
    playNextCellWave();
    return;
  }
  cellWaveActive = true;
  cells.forEach((cell, order) => {
    cell.style.setProperty("--wave-delay", `${order * 72}ms`);
    cell.classList.add("wave-hop", `wave-${wave.type}`);
  });
  setTimeout(() => {
    cells.forEach((cell) => {
      cell.classList.remove("wave-hop", "wave-row", "wave-box");
      cell.style.removeProperty("--wave-delay");
    });
    cellWaveActive = false;
    playNextCellWave();
  }, 1350);
}

function setupAdventure() {
  const rules = ADVENTURE_RULES[game.difficulty];
  equippedCards = equippedCards.filter((cardId) => progress.inventory[cardId] > 0).slice(0, 2);
  Object.assign(game, {
    maxHealth: rules.maxHealth,
    health: rules.maxHealth,
    shields: 0,
    failed: false,
    actions: 0,
    correctStreak: 0,
    healGoals: { streak: false, row: false, box: false },
    completedUnits: { rows: [], boxes: [] },
    hintsUsed: 0,
    frozenSeconds: 0,
    xpMultiplier: 1,
    extraCardClaims: 0,
    equippedCards: [...equippedCards],
    usedCards: [],
    cardChoices: [],
    claimedCards: [],
    remainingClaims: 0,
    started: false
  });
}

function sessionSnapshot() {
  if (game.completed || game.failed) return null;
  return { game, equippedCards, alinMode };
}

function persistSession() {
  const session = sessionSnapshot();
  if (session) saveSession(session);
  else clearSession();
  scheduleCloudSync();
}

function render() {
  persistSession();
  const levelTarget = progress.level * 100;
  const selectedValue = game.values[game.selected];
  const related = relatedCells(game.selected);
  const inventoryTotal = Object.values(progress.inventory).reduce((total, count) => total + count, 0);
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div class="brand">${mascot()}<div><span>阿霖的數獨島</span><small>ALIN'S SUDOKU ISLAND</small></div></div>
        <div class="topbar-actions"><div class="wallet" aria-label="玩家資源"><span>⭐ ${progress.totalStars}</span><span>🪙 ${progress.coins}</span></div><button id="open-leaderboard" class="save-button">🏆 <span>排行</span></button><button id="open-save-center" class="save-button">💾 <span>存檔</span></button></div>
      </header>

      <section class="hero-card">
        <div><p class="eyebrow">${progress.playerName ? `${escapeHtml(progress.playerName)}・` : ""}LEVEL ${progress.level}</p><h1>今天也來解一題吧！</h1><p>每完成一局，就讓小島長大一點。</p></div>
        <div class="level-ring" style="--progress:${Math.round((progress.xp / levelTarget) * 360)}deg"><span>${progress.xp}<small>/${levelTarget} XP</small></span></div>
      </section>

      <section class="game-layout">
        <aside class="side-panel difficulty-panel">
          <div class="section-title"><span>選擇旅程</span><small>難度</small></div>
          <div class="difficulty-list">
            ${Object.entries(DIFFICULTIES).map(([key, item]) => `
              <button class="difficulty ${game.difficulty === key ? "active" : ""}" data-difficulty="${key}">
                <span class="difficulty-icon">${item.icon}</span>
                <span><strong>${item.label}</strong><small>${ADVENTURE_RULES[key].maxHealth} 心・${item.xp} XP・${ADVENTURE_RULES[key].treasurePoolSize} 種寶物</small></span>
              </button>`).join("")}
          </div>
          <div class="difficulty-summary">🌱 35 XP／10 種　🌼 60 XP／30 種　🏆 100 XP／60 種</div>
          <button class="alin-mode ${alinMode ? "active" : ""}" id="alin-mode" aria-pressed="${alinMode}">
            <span>🌈</span><span><strong>阿霖模式</strong><small>${alinMode ? "已開啟・不限失誤" : "開啟後不會失敗"}</small></span>
          </button>
          <div class="island-card"><span>🏝️</span><div><strong>我的小島</strong><small>${progress.totalStars} 顆星・完成 ${progress.completedGames} 局</small></div></div>
        </aside>

        <section class="board-card" aria-label="數獨遊戲">
          <div class="board-buddies" aria-hidden="true"><span class="cat-buddy">🐱</span><span class="mouse-buddy">🐭</span></div>
          <div class="game-meta">
            <span class="difficulty-pill">${DIFFICULTIES[game.difficulty].icon} ${DIFFICULTIES[game.difficulty].label}・第 ${game.floor} 層</span>
            <span class="timer-block" aria-label="經過時間，沒有時間限制"><span>⏱ <strong id="timer">${formatTime(game.elapsed)}</strong></span><small>不限時 · ${formatTime(DIFFICULTIES[game.difficulty].bonusTime)} 內 +${DIFFICULTIES[game.difficulty].bonusCoins} 🪙 <i id="freeze-time">${game.frozenSeconds ? `· 凍結 ${game.frozenSeconds}s` : ""}</i></small></span>
            <button class="icon-button" id="restart" aria-label="重新開始">↻</button>
          </div>
          <div class="adventure-status">
            <span class="health">${alinMode ? "🌈 不限失誤" : `${"❤️".repeat(game.health)}${"🤍".repeat(Math.max(0, game.maxHealth - game.health))}`}${game.shields ? ` 🛡️${game.shields}` : ""}</span>
            ${game.floor > 1 ? `<span class="farm-badge">♻️ 探索層：55% XP・每 3 層寶物</span>` : ""}
            <div class="goal-chips" aria-label="回血目標">
              <span class="${game.healGoals.streak ? "done" : ""}">連對 8 格</span><span class="${game.healGoals.row ? "done" : ""}">完成一行</span><span class="${game.healGoals.box ? "done" : ""}">完成一宮</span>
            </div>
          </div>
          <div class="sudoku-board ${game.started ? "" : "waiting"}" role="grid" aria-label="${game.started ? "數獨盤面" : "按下開始後顯示題目"}">
            ${game.values.map((value, index) => {
              const fixed = game.puzzle[index] !== 0;
              const selected = index === game.selected;
              const same = selectedValue && value === selectedValue;
              return `<button class="cell ${fixed ? "fixed" : ""} ${selected ? "selected" : ""} ${related.has(index) ? "related" : ""} ${same ? "same" : ""}" data-cell="${index}" role="gridcell" ${game.started ? "" : "disabled"} aria-label="${game.started ? `第 ${Math.floor(index / 9) + 1} 列第 ${(index % 9) + 1} 欄${value ? `，數字 ${value}` : "，空白"}` : "題目尚未開始"}">
                ${game.started ? (value || (game.notes[index].length ? `<span class="notes">${Array.from({ length: 9 }, (_, n) => `<i>${game.notes[index].includes(n + 1) ? n + 1 : ""}</i>`).join("")}</span>` : "")) : ""}
              </button>`;
            }).join("")}
          </div>
          <div class="tools">
            <button id="undo" aria-label="清除目前格"><span>⌫</span><small>清除</small></button>
            <button id="notes" class="${noteMode ? "active" : ""}" aria-pressed="${noteMode}"><span>✎</span><small>筆記 ${noteMode ? "開" : "關"}</small></button>
            <button id="hint"><span>💡</span><small>${currentHintCost() ? `提示 -${currentHintCost()}` : "免費提示"}</small></button>
          </div>
          <div class="number-pad" aria-label="數字鍵盤">${Array.from({ length: 9 }, (_, index) => `<button data-number="${index + 1}">${index + 1}</button>`).join("")}</div>
          <p class="mistakes">${alinMode ? `🌈 阿霖模式・目前答錯 ${game.mistakes} 次` : `本局答錯 ${game.mistakes} 次`}</p>
          <div class="card-tray">
            <button id="open-backpack" class="backpack-button">🎒 背包 ${inventoryTotal}</button>
            ${game.equippedCards.length ? game.equippedCards.map((cardId) => {
              const card = TREASURE_CARDS[cardId];
              const reviveOnly = card.effect === "revive";
              const automatic = TREASURE_AUTO_EFFECTS.includes(card.effect);
              const used = game.usedCards.includes(cardId);
              const status = reviveOnly ? "・倒下時使用" : automatic ? "・已自動生效" : used ? "・本局已使用" : ` ×${progress.inventory[cardId]}`;
              return `<button data-use-card="${cardId}" ${progress.inventory[cardId] && !reviveOnly && !automatic && !used ? "" : "disabled"}><span>${card.icon}</span><small>${card.name}${status}</small></button>`;
            }).join("") : `<small class="empty-loadout">開局前可從背包裝備兩張卡</small>`}
          </div>
        </section>

        <aside class="side-panel reward-panel">
          <div class="section-title"><span>冒險獎勵</span><small>永久累積</small></div>
          <div class="quest"><span class="quest-icon">🎯</span><div><strong>完成一局</strong><small>${Math.min(progress.completedGames, 1)}/1</small><div class="mini-progress"><i style="width:${progress.completedGames ? 100 : 10}%"></i></div></div></div>
          <div class="reward-preview"><span class="chest">🎁</span><strong>${ADVENTURE_RULES[game.difficulty].treasurePoolSize} 種寶物池</strong><small>第 1 層必掉，之後每 3 層掉落</small></div>
          <button id="open-backpack-side" class="daily-button">🎒 寶物背包・${inventoryTotal} 張</button>
        </aside>
      </section>
    </main>
    ${showNameSetup ? nameSetupModal() : showLeaderboard ? leaderboardModal() : showSaveCenter ? saveCenterModal() : showBackpack ? backpackModal() : !game.started ? startModal() : game.completed ? completionModal() : game.failed ? failureModal() : ""}
  `;
  bindEvents();
  playNextCellWave();
}

function startModal() {
  const selectedCards = equippedCards.map((cardId) => TREASURE_CARDS[cardId]).filter(Boolean);
  return `<div class="modal-backdrop"><section class="modal start-modal" role="dialog" aria-modal="true" aria-labelledby="start-title">
    <div class="start-friends" aria-hidden="true"><span>🐱</span><span>🏝️</span><span>🐭</span></div><p class="eyebrow">FLOOR ${game.floor}</p><h2 id="start-title">出發前選寶物</h2>
    <p>先確認難度與本關寶物，按下開始後才會顯示題目並開始計時。</p>
    <div class="prestart-difficulties" aria-label="選擇難度">${Object.entries(DIFFICULTIES).map(([key, item]) => `<button data-prestart-difficulty="${key}" class="${game.difficulty === key ? "active" : ""}">${item.icon} ${item.label}</button>`).join("")}</div>
    <button id="prestart-alin-mode" class="prestart-alin ${alinMode ? "active" : ""}" aria-pressed="${alinMode}">♾️ 阿霖模式：${alinMode ? "開啟" : "關閉"}</button>
    <div class="prestart-loadout">
      <strong>本關寶物 ${selectedCards.length}/2</strong>
      <span>${selectedCards.length ? selectedCards.map((card) => `${card.icon} ${card.name}`).join("　") : "尚未選擇（也可空手出發）"}</span>
    </div>
    <button id="choose-start-cards" class="secondary-button">🎒 選擇／更換寶物</button>
    <button id="open-start-leaderboard" class="secondary-button leaderboard-button">🏆 查看排行榜</button>
    <button id="start-game" class="primary-button">▶ 開始第 ${game.floor} 層</button>
  </section></div>`;
}

function completionModal() {
  const totalCoins = Math.ceil(game.xpReward / 5) + game.timeBonus;
  return `<div class="modal-backdrop"><section class="modal completion-modal" role="dialog" aria-modal="true" aria-labelledby="complete-title">
    <div class="celebrate">🎉</div><p class="eyebrow">FLOOR ${game.floor} COMPLETE</p><h2 id="complete-title">第 ${game.floor} 層完成！</h2>
    <div class="stars-earned" aria-label="獲得 ${game.stars} 顆星">${"⭐".repeat(game.stars)}${"☆".repeat(3 - game.stars)}</div>
    <div class="reward-row"><span>⭐ +${game.xpReward} XP</span><span>🪙 +${totalCoins}</span></div>
    <p class="cloud-result">${leaderboardConfigured() ? "🏆 成績已加入全球排行同步佇列" : "🏆 排行榜等待連接資料庫"}</p>
    ${game.floor > 1 ? `<p class="farm-reward-note">探索層採 55% 經驗；下一局前往第 ${game.floor + 1} 層</p>` : ""}
    ${game.timeBonus ? `<p class="speed-bonus">⚡ 目標時間內完成，速度獎勵 +${game.timeBonus} 金幣</p>` : `<p class="speed-bonus calm">慢慢玩也很好，關卡沒有時間限制</p>`}
    <div class="card-draw"><strong>${game.remainingClaims ? `選擇 ${game.remainingClaims} 張寶物卡帶走` : game.claimedCards.length ? "寶物已放進背包" : `本層沒有寶物・第 ${Math.ceil((game.floor + 1) / 3) * 3} 層再次掉落`}</strong><div>
      ${game.cardChoices.map((cardId) => {
        const card = TREASURE_CARDS[cardId];
        const claimed = game.claimedCards.includes(cardId);
        return `<button data-claim-card="${cardId}" class="treasure-card ${card.rarity} ${claimed ? "claimed" : ""}" ${claimed || !game.remainingClaims ? "disabled" : ""}><span>${card.icon}</span><strong>${card.name}</strong><small>${card.description}</small></button>`;
      }).join("")}
    </div></div>
    <button id="next-game" class="primary-button" ${game.remainingClaims ? "disabled" : ""}>再玩一局</button>
  </section></div>`;
}

function nameSetupModal() {
  return `<div class="modal-backdrop"><section class="modal name-modal" role="dialog" aria-modal="true" aria-labelledby="name-title">
    <div class="celebrate">🏝️</div><p class="eyebrow">WELCOME</p><h2 id="name-title">冒險家叫什麼名字？</h2>
    <p>名稱會顯示在家庭排行榜。4 位數家庭 PIN 用來在其他裝置找回雲端存檔。</p>
    <label class="field-label" for="player-name">玩家名稱</label>
    <input id="player-name" class="name-input" maxlength="16" autocomplete="nickname" value="${escapeHtml(progress.playerName || "")}" placeholder="例如：阿霖">
    <label class="field-label" for="family-pin">家庭 PIN</label>
    <input id="family-pin" class="name-input pin-input" type="text" maxlength="4" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" autocomplete="off" placeholder="4 位數字">
    <p class="name-status" role="status">${escapeHtml(nameSetupStatus || (cloudConfigured() ? "第一次玩請建立玩家；換裝置請載入雲端進度。" : "資料庫尚未設定，目前可先建立本機玩家。"))}</p>
    <div class="save-actions"><button id="create-player">✨ 建立新玩家</button><button id="load-cloud-player" ${cloudConfigured() ? "" : "disabled"}>☁️ 載入雲端進度</button></div>
  </section></div>`;
}

function leaderboardModal() {
  const configured = leaderboardConfigured();
  return `<div class="modal-backdrop"><section class="modal leaderboard-modal" role="dialog" aria-modal="true" aria-labelledby="leaderboard-title">
    <div class="celebrate">🏆</div><h2 id="leaderboard-title">家庭全球排行</h2>
    <div class="leaderboard-tabs">${Object.entries(DIFFICULTIES).map(([key, item]) => `<button data-rank-difficulty="${key}" class="${leaderboardDifficulty === key ? "active" : ""}">${item.icon} ${item.label}</button>`).join("")}</div>
    ${!configured ? `<div class="empty-ranking"><strong>尚未連接資料庫</strong><small>設定 Supabase 後，家人的成績會出現在這裡。</small></div>` : leaderboardStatus ? `<div class="empty-ranking"><span class="loading-orbit">☁️</span><small>${escapeHtml(leaderboardStatus)}</small></div>` : leaderboardRows.length ? `<div class="leaderboard-list">${leaderboardRows.map((row, index) => `
      <div class="leaderboard-row ${row.player_id === progress.playerId ? "mine" : ""}"><b>${index + 1}</b><span><strong>${escapeHtml(row.player_name)}</strong><small>${row.stars}⭐・${row.mistakes} 次失誤・${formatTime(row.elapsed_seconds)}</small></span><em>第 ${row.floor} 層</em></div>`).join("")}</div>` : `<div class="empty-ranking"><strong>還沒有成績</strong><small>完成第一層就能成為榜首！</small></div>`}
    <p class="pending-scores">${pendingScoreCount() ? `尚有 ${pendingScoreCount()} 筆離線成績等待同步` : "每位玩家、每個難度只保留最佳成績"}</p>
    <button id="close-leaderboard" class="primary-button">回到遊戲</button>
  </section></div>`;
}

function saveCenterModal() {
  const configured = cloudConfigured();
  const pinReady = validCloudPin(loadCloudPin());
  return `<div class="modal-backdrop"><section class="modal save-modal" role="dialog" aria-modal="true" aria-labelledby="save-title">
    <div class="celebrate">☁️</div><h2 id="save-title">雲端存檔</h2>
    <p>本機會隨時自動保存；連上網路後，玩家資料、裝備、XP、層數和目前盤面也會同步到家庭雲端。</p>
    <div class="cloud-card ${configured && pinReady ? "ready" : "waiting"}"><span>${configured && pinReady ? "✅" : "⚙️"}</span><div><strong>${configured ? (pinReady ? "雲端同步已就緒" : "需要設定家庭 PIN") : "等待設定 Supabase"}</strong><small>${escapeHtml(cloudSyncStatus || (configured ? `玩家：${progress.playerName}` : "設定完成前仍會安全保存在這台裝置"))}</small></div></div>
    <div class="save-actions"><button id="sync-cloud-now" ${configured && pinReady ? "" : "disabled"}>☁️ 立即同步</button><button id="switch-cloud-player">👤 更換／載入玩家</button></div>
    <button id="close-save-center" class="primary-button">回到遊戲</button>
  </section></div>`;
}

function availableReviveCard() {
  return strongestEquippedRevive(game.equippedCards, progress.inventory);
}

function failureModal() {
  const reviveCardId = availableReviveCard();
  const reviveCard = reviveCardId ? TREASURE_CARDS[reviveCardId] : null;
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="failure-title">
    <div class="celebrate">🌧️</div><p class="eyebrow">TAKE A BREATH</p><h2 id="failure-title">暫時迷路了</h2><p>可以復活繼續，也可以重新挑戰這一題。</p>
    <div class="failure-actions">
      <button id="revive-card" ${reviveCard ? "" : "disabled"}>${reviveCard ? `${reviveCard.icon} ${reviveCard.name} ×${progress.inventory[reviveCardId]}` : "🪶 本關未裝備復活寶物"}</button>
      <button id="revive-coins" ${progress.coins >= 20 ? "" : "disabled"}>🪙 20 金幣復活</button>
    </div>
    <button id="retry-game" class="primary-button">重新挑戰</button>
  </section></div>`;
}

function backpackModal() {
  const locked = game.started;
  return `<div class="modal-backdrop"><section class="modal backpack-modal" role="dialog" aria-modal="true" aria-labelledby="backpack-title">
    <div class="celebrate">🎒</div><h2 id="backpack-title">寶物背包</h2><p>${locked ? "本局已開始，下局開始前可重新裝備。" : "選擇最多兩種卡片帶進本局。"}</p>
    <div class="inventory-grid">${Object.entries(TREASURE_CARDS).filter(([cardId]) => progress.inventory[cardId] > 0).map(([cardId, card]) => `
      <button data-equip-card="${cardId}" class="inventory-card ${card.rarity} ${equippedCards.includes(cardId) ? "equipped" : ""}" ${locked || !progress.inventory[cardId] ? "disabled" : ""}>
        <span>${card.icon}</span><strong>${card.name} ×${progress.inventory[cardId]}</strong><small>${card.description}</small>
      </button>`).join("") || `<p class="empty-inventory">背包目前是空的，過關抽卡後就會收藏在這裡。</p>`}</div>
    <button id="close-backpack" class="primary-button">完成</button>
  </section></div>`;
}

function bindEvents() {
  document.querySelectorAll("[data-cell]").forEach((button) => button.addEventListener("click", () => { game.selected = Number(button.dataset.cell); render(); }));
  document.querySelectorAll("[data-number]").forEach((button) => button.addEventListener("click", () => enterNumber(Number(button.dataset.number))));
  document.querySelectorAll("[data-difficulty]").forEach((button) => button.addEventListener("click", () => newGame(button.dataset.difficulty)));
  document.querySelectorAll("[data-prestart-difficulty]").forEach((button) => button.addEventListener("click", () => newGame(button.dataset.prestartDifficulty)));
  document.querySelectorAll("[data-use-card]").forEach((button) => button.addEventListener("click", () => useCard(button.dataset.useCard)));
  document.querySelectorAll("[data-equip-card]").forEach((button) => button.addEventListener("click", () => toggleEquipCard(button.dataset.equipCard)));
  document.querySelectorAll("[data-claim-card]").forEach((button) => button.addEventListener("click", () => claimCard(button.dataset.claimCard)));
  document.querySelector("#notes")?.addEventListener("click", () => { noteMode = !noteMode; render(); });
  document.querySelector("#alin-mode")?.addEventListener("click", () => { alinMode = !alinMode; render(); });
  document.querySelector("#prestart-alin-mode")?.addEventListener("click", () => { alinMode = !alinMode; render(); });
  document.querySelector("#undo")?.addEventListener("click", clearCell);
  document.querySelector("#hint")?.addEventListener("click", useHint);
  document.querySelector("#restart")?.addEventListener("click", () => newGame(game.difficulty));
  document.querySelector("#next-game")?.addEventListener("click", () => newGame(game.difficulty));
  document.querySelector("#retry-game")?.addEventListener("click", () => newGame(game.difficulty));
  document.querySelector("#revive-card")?.addEventListener("click", reviveWithCard);
  document.querySelector("#revive-coins")?.addEventListener("click", reviveWithCoins);
  document.querySelector("#open-backpack")?.addEventListener("click", openBackpack);
  document.querySelector("#open-backpack-side")?.addEventListener("click", openBackpack);
  document.querySelector("#choose-start-cards")?.addEventListener("click", openBackpack);
  document.querySelector("#start-game")?.addEventListener("click", startGame);
  document.querySelector("#open-leaderboard")?.addEventListener("click", openLeaderboardModal);
  document.querySelector("#open-start-leaderboard")?.addEventListener("click", openLeaderboardModal);
  document.querySelector("#close-leaderboard")?.addEventListener("click", () => { showLeaderboard = false; render(); });
  document.querySelectorAll("[data-rank-difficulty]").forEach((button) => button.addEventListener("click", () => changeLeaderboardDifficulty(button.dataset.rankDifficulty)));
  document.querySelector("#open-save-center")?.addEventListener("click", openSaveCenter);
  document.querySelector("#close-save-center")?.addEventListener("click", () => { showSaveCenter = false; render(); });
  document.querySelector("#sync-cloud-now")?.addEventListener("click", () => syncCloudNow(true));
  document.querySelector("#switch-cloud-player")?.addEventListener("click", () => { showSaveCenter = false; showNameSetup = true; nameSetupStatus = ""; render(); });
  document.querySelector("#family-pin")?.addEventListener("input", (event) => {
    event.currentTarget.value = normalizePinInput(event.currentTarget.value);
  });
  document.querySelector("#create-player")?.addEventListener("click", createPlayer);
  document.querySelector("#load-cloud-player")?.addEventListener("click", loadExistingPlayer);
  document.querySelector("#close-backpack")?.addEventListener("click", () => { showBackpack = false; game.equippedCards = [...equippedCards]; render(); });
}

function openSaveCenter() {
  cloudSyncStatus = cloudConfigured() ? "可手動立即同步，遊戲中也會定期自動同步。" : "請先完成 Supabase 設定。";
  showSaveCenter = true;
  render();
}

function playerSetupValues() {
  const playerName = document.querySelector("#player-name")?.value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 16) || "";
  const pin = normalizePinInput(document.querySelector("#family-pin")?.value || "");
  if (!playerName) throw new Error("請輸入玩家名稱");
  if (!validCloudPin(pin)) throw new Error("家庭 PIN 必須是 4 位數字");
  return { playerName, pin };
}

async function createPlayer() {
  try {
    const { playerName, pin } = playerSetupValues();
    const nextProgress = { ...progress, playerName };
    if (cloudConfigured() && navigator.onLine) {
      nameSetupStatus = "正在建立家庭雲端存檔…";
      document.querySelector(".name-status").textContent = nameSetupStatus;
      await saveCloudProgress({ playerId: nextProgress.playerId, playerName, pin, saveCode: exportSaveCode(nextProgress, sessionSnapshot()) });
    }
    progress = nextProgress;
    saveProgress(progress);
    saveCloudPin(pin);
    showNameSetup = false;
    nameSetupStatus = "";
    render();
    showCelebration("👋", `歡迎，${playerName}！`, cloudConfigured() ? "雲端存檔已建立" : "目前使用本機存檔");
  } catch (error) {
    nameSetupStatus = error.message || "無法建立玩家";
    const status = document.querySelector(".name-status");
    if (status) status.textContent = nameSetupStatus;
  }
}

function applyImportedSave(imported) {
  progress = imported.progress;
  if (imported.session) {
    game = imported.session.game;
    equippedCards = imported.session.equippedCards || [];
    alinMode = imported.session.alinMode || false;
  } else {
    game = createGame("easy");
    setupAdventure();
    game.floor = progress.floors.easy;
  }
}

async function loadExistingPlayer() {
  try {
    const { playerName, pin } = playerSetupValues();
    nameSetupStatus = "正在尋找雲端存檔…";
    document.querySelector(".name-status").textContent = nameSetupStatus;
    const saveCode = await loadCloudProgress(playerName, pin);
    applyImportedSave(importSaveCode(saveCode));
    saveCloudPin(pin);
    showNameSetup = false;
    nameSetupStatus = "";
    startTimer();
    render();
    showCelebration("☁️", `歡迎回來，${progress.playerName}！`, `從第 ${game.floor} 層繼續冒險`);
  } catch (error) {
    nameSetupStatus = error.message || "無法載入雲端進度";
    const status = document.querySelector(".name-status");
    if (status) status.textContent = nameSetupStatus;
  }
}

function scheduleCloudSync() {
  if (!cloudConfigured() || !progress.playerName || !validCloudPin(loadCloudPin())) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => syncCloudNow(false), 1800);
}

async function syncCloudNow(showFeedback = false) {
  const pin = loadCloudPin();
  if (!cloudConfigured() || !validCloudPin(pin) || !progress.playerName) return;
  if (showFeedback) {
    cloudSyncStatus = "正在同步完整冒險進度…";
    render();
  }
  try {
    await saveCloudProgress({ playerId: progress.playerId, playerName: progress.playerName, pin, saveCode: exportSaveCode(progress, sessionSnapshot()) });
    cloudSyncStatus = `同步完成・${new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`;
    if (showFeedback && showSaveCenter) render();
  } catch (error) {
    cloudSyncStatus = error.message || "同步失敗，本機進度不受影響";
    if (showFeedback && showSaveCenter) render();
  }
}

async function openLeaderboardModal() {
  showLeaderboard = true;
  leaderboardDifficulty = game.difficulty;
  leaderboardRows = [];
  leaderboardStatus = leaderboardConfigured() ? "正在讀取全球排行…" : "";
  render();
  await refreshLeaderboard();
}

async function refreshLeaderboard() {
  if (!leaderboardConfigured()) return;
  try {
    leaderboardRows = await fetchLeaderboard(leaderboardDifficulty);
    leaderboardStatus = "";
  } catch (error) {
    leaderboardRows = [];
    leaderboardStatus = error.message || "排行榜暫時無法連線";
  }
  if (showLeaderboard) render();
}

function changeLeaderboardDifficulty(difficulty) {
  leaderboardDifficulty = difficulty;
  leaderboardRows = [];
  leaderboardStatus = "正在讀取全球排行…";
  render();
  refreshLeaderboard();
}

function openBackpack() {
  showBackpack = true;
  render();
}

function toggleEquipCard(cardId) {
  if (game.started || !progress.inventory[cardId]) return;
  if (equippedCards.includes(cardId)) equippedCards = equippedCards.filter((id) => id !== cardId);
  else if (equippedCards.length < 2) equippedCards.push(cardId);
  game.equippedCards = [...equippedCards];
  render();
}

function enterNumber(number) {
  const index = game.selected;
  if (!game.started || game.completed || game.failed || game.puzzle[index]) return;
  if (noteMode) {
    const notes = new Set(game.notes[index]);
    notes.has(number) ? notes.delete(number) : notes.add(number);
    game.notes[index] = [...notes];
  } else if (game.solution[index] !== number) {
    game.actions += 1;
    game.mistakes += 1;
    game.correctStreak = 0;
    let blockedByShield = false;
    if (!alinMode) {
      if (game.shields) {
        game.shields -= 1;
        blockedByShield = true;
      }
      else game.health -= 1;
      if (game.health <= 0) {
        game.failed = true;
        clearInterval(timerId);
      }
    }
    if (blockedByShield) showGameEffect("🛡️", "鏘！成功格擋", "護盾替你擋住這次錯誤", "shield");
    else showGameEffect("🐱🐭", "猜錯了，雙雙昏倒！", alinMode ? "躺一下再繼續，阿霖模式不會失敗" : "貓咪和老鼠休息一下，再陪你試一次！", "mistake");
    document.body.classList.add("shake");
    setTimeout(() => document.body.classList.remove("shake"), 320);
  } else {
    game.actions += 1;
    game.correctStreak += 1;
    game.values[index] = number;
    game.notes[index] = [];
    removeRelatedNotes(index, number);
    checkHealGoals();
    checkCompletion();
  }
  render();
}

function removeRelatedNotes(index, number) {
  relatedCells(index).forEach((cell) => { game.notes[cell] = game.notes[cell].filter((note) => note !== number); });
}

function clearCell() {
  if (!game.started || game.completed || game.failed) return;
  if (!game.puzzle[game.selected]) {
    game.values[game.selected] = 0;
    game.notes[game.selected] = [];
    render();
  }
}

function healOrShield() {
  if (alinMode) return "阿霖模式目標達成";
  if (game.health < game.maxHealth) {
    game.health += 1;
    return "回復 1 顆心";
  }
  game.shields += 1;
  return "獲得 1 層護盾";
}

function completeHealGoal(goal, label) {
  game.healGoals[goal] = true;
  const reward = healOrShield();
  showCelebration("🎉", `恭喜完成「${label}」！`, reward);
  showGameEffect("🐱🐭", "扭腰擺臀慶祝！", `${label}・${reward}`, "success");
}

function celebrateCompletedUnit(type, unitIndex) {
  const goal = type === "row" ? "row" : "box";
  const label = type === "row" ? `第 ${unitIndex + 1} 行` : `第 ${unitIndex + 1} 宮`;
  const firstReward = !game.healGoals[goal];
  let detail = `${label}完成，9 格一起跳波浪舞！`;
  if (firstReward) {
    game.healGoals[goal] = true;
    const reward = healOrShield();
    detail = `${detail}・${reward}`;
    showCelebration("🎉", `首次完成${type === "row" ? "一行" : "一宮"}！`, reward);
  }
  queueCellWave(type, unitIndex);
  showGameEffect("🐱🐭", `${label}完成，扭起來！`, detail, "success");
}

function checkHealGoals() {
  if (!game.healGoals.streak && game.correctStreak >= 8) completeHealGoal("streak", "連對 8 格");
  if (!game.completedUnits) game.completedUnits = { rows: [], boxes: [] };
  const newlyCompleted = newlyCompletedSudokuUnits(game.values, game.completedUnits);
  newlyCompleted.rows.forEach((row) => {
    game.completedUnits.rows.push(row);
    celebrateCompletedUnit("row", row);
  });
  newlyCompleted.boxes.forEach((box) => {
    game.completedUnits.boxes.push(box);
    celebrateCompletedUnit("box", box);
  });
}

function useHint() {
  const cost = currentHintCost();
  if (!game.started || game.failed || progress.coins < cost || game.puzzle[game.selected] || game.values[game.selected]) return;
  if (cost) progress = spendCoins(progress, cost);
  game.actions += 1;
  game.hintsUsed += 1;
  game.values[game.selected] = game.solution[game.selected];
  removeRelatedNotes(game.selected, game.values[game.selected]);
  checkHealGoals();
  checkCompletion();
  render();
}

function useCard(cardId) {
  if (!game.started || !game.equippedCards.includes(cardId) || !progress.inventory[cardId] || game.usedCards.includes(cardId) || game.completed || game.failed) return;
  const card = TREASURE_CARDS[cardId];
  const index = game.selected;
  let resultDetail = card.description;
  if (card.effect === "hint") {
    const targets = applyHintTreasure(game, card, index);
    if (!targets.length) return;
    game.actions += 1;
    game.hintsUsed += targets.length;
    targets.forEach((target) => {
      removeRelatedNotes(target, game.values[target]);
    });
    resultDetail = `已填入 ${targets.length} 格正確答案`;
    checkHealGoals();
    checkCompletion();
  } else if (card.effect === "revive") return;
  else if (!applyImmediateTreasure(game, card, { alinMode, index })) return;
  progress = consumeCard(progress, cardId);
  game.usedCards.push(cardId);
  render();
  showGameEffect(card.icon, `${card.name}發動！`, resultDetail, "card");
}

function reviveWithCard() {
  const cardId = availableReviveCard();
  if (!cardId) return;
  const card = TREASURE_CARDS[cardId];
  const health = card.value;
  progress = consumeCard(progress, cardId);
  resumeAfterRevive(health, card);
}

function reviveWithCoins() {
  if (progress.coins < 20) return;
  progress = spendCoins(progress, 20);
  resumeAfterRevive(2, { icon: "🪙", name: "金幣復活", description: "恢復 2 顆心，繼續挑戰" });
}

function resumeAfterRevive(health = 2, source = null) {
  game.failed = false;
  game.health = Math.min(health, game.maxHealth);
  startTimer();
  render();
  if (source) showGameEffect(source.icon, `${source.name}發動！`, source.description, "card");
}

function claimCard(cardId) {
  if (!game.completed || !game.remainingClaims || game.claimedCards.includes(cardId) || !game.cardChoices.includes(cardId)) return;
  progress = addCard(progress, cardId);
  game.claimedCards.push(cardId);
  game.remainingClaims -= 1;
  render();
  const card = TREASURE_CARDS[cardId];
  showCelebration(card.icon, `恭喜獲得「${card.name}」！`, "已放進寶物背包");
}

function checkCompletion() {
  if (game.completed || !game.values.every((value, index) => value === game.solution[index])) return;
  game.completed = true;
  clearInterval(timerId);
  const reward = DIFFICULTIES[game.difficulty];
  game.stars = calculateStars(game);
  const farmMultiplier = game.floor > 1 ? 0.55 : 1;
  game.xpReward = Math.max(10, Math.round(reward.xp * game.xpMultiplier * farmMultiplier));
  game.timeBonus = game.elapsed <= reward.bonusTime ? reward.bonusCoins : 0;
  game.remainingClaims = treasureClaimsForFloor(game.floor, game.extraCardClaims);
  game.cardChoices = game.remainingClaims ? drawTreasureCards(game.difficulty, game.stars, Math.max(3, game.remainingClaims)) : [];
  progress = rewardProgress(progress, game.xpReward, game.timeBonus, game.stars, game.difficulty);
  clearSession();
  queueLeaderboardScore(buildScore(progress, game)).catch(() => {});
  syncCloudNow(false);
}

function startTimer() {
  clearInterval(timerId);
  if (!game.started || game.completed || game.failed) return;
  timerId = setInterval(() => {
    if (game.frozenSeconds > 0) game.frozenSeconds -= 1;
    else game.elapsed += 1;
    const timer = document.querySelector("#timer");
    const freeze = document.querySelector("#freeze-time");
    if (timer) timer.textContent = formatTime(game.elapsed);
    if (freeze) freeze.textContent = game.frozenSeconds ? `· 凍結 ${game.frozenSeconds}s` : "";
    if (game.elapsed % 10 === 0) persistSession();
  }, 1000);
}

function startGame() {
  if (game.started || game.completed || game.failed) return;
  game.started = true;
  game.startedAt = Date.now();
  game.equippedCards = [...equippedCards];
  const activatedCards = activateAutomaticTreasures(game, game.equippedCards, progress.inventory, { alinMode });
  activatedCards.forEach((cardId) => {
    progress = consumeCard(progress, cardId);
  });
  startTimer();
  render();
  activatedCards.forEach((cardId) => {
    const card = TREASURE_CARDS[cardId];
    showGameEffect(card.icon, `${card.name}自動發動！`, card.description, "card");
  });
}

function newGame(difficulty) {
  clearInterval(timerId);
  cellWaveQueue = [];
  cellWaveActive = false;
  game = createGame(difficulty);
  game.floor = progress.floors[difficulty] || 1;
  noteMode = false;
  showBackpack = false;
  setupAdventure();
  render();
}

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isFormControl = target instanceof HTMLElement
    && (target.matches("input, textarea, select, button") || target.isContentEditable);
  if (isFormControl || showNameSetup || showSaveCenter || showLeaderboard || showBackpack) return;
  if (/^[1-9]$/.test(event.key)) enterNumber(Number(event.key));
  if (["Backspace", "Delete", "0"].includes(event.key)) clearCell();
  if (event.key.toLowerCase() === "n") { noteMode = !noteMode; render(); }
});

if (restoredSession) {
  startTimer();
  render();
} else newGame("easy");

window.addEventListener("online", () => {
  flushPendingScores().catch(() => {});
  syncCloudNow(false);
});
flushPendingScores().catch(() => {});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register(new URL("sw.js", document.baseURI)).catch(() => {});
}
