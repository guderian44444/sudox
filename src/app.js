import { createGame, DIFFICULTIES, relatedCells } from "./game/sudoku.js";
import { ADVENTURE_RULES, calculateStars, candidatesFor, drawTreasureCards, TREASURE_CARDS } from "./game/adventure.js";
import { addCard, consumeCard, loadProgress, rewardProgress, saveProgress, spendCoins } from "./state/store.js";

const app = document.querySelector("#app");
let progress = loadProgress();
let game = createGame("easy");
let noteMode = false;
let alinMode = false;
let showBackpack = false;
let equippedCards = [];
let timerId;

const unlockOrder = ["easy", "medium", "hard"];
const isUnlocked = (difficulty) => unlockOrder.indexOf(difficulty) <= unlockOrder.indexOf(progress.unlockedDifficulty);
const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const currentHintCost = () => alinMode ? 0 : DIFFICULTIES[game.difficulty].hintCost;

function mascot() {
  return `<div class="mascot" aria-hidden="true"><span class="ear left"></span><span class="ear right"></span><span class="face">•ᴗ•</span></div>`;
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
    hintsUsed: 0,
    frozenSeconds: 0,
    xpMultiplier: 1,
    extraCardClaims: 0,
    equippedCards: [...equippedCards],
    usedCards: [],
    cardChoices: [],
    claimedCards: [],
    remainingClaims: 0
  });
}

function render() {
  const levelTarget = progress.level * 100;
  const selectedValue = game.values[game.selected];
  const related = relatedCells(game.selected);
  const inventoryTotal = Object.values(progress.inventory).reduce((total, count) => total + count, 0);
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div class="brand">${mascot()}<div><span>阿霖的數獨島</span><small>ALIN'S SUDOKU ISLAND</small></div></div>
        <div class="wallet" aria-label="玩家資源"><span>⭐ ${progress.totalStars}</span><span>🪙 ${progress.coins}</span></div>
      </header>

      <section class="hero-card">
        <div><p class="eyebrow">LEVEL ${progress.level}</p><h1>今天也來解一題吧！</h1><p>每完成一局，就讓小島長大一點。</p></div>
        <div class="level-ring" style="--progress:${Math.round((progress.xp / levelTarget) * 360)}deg"><span>${progress.xp}<small>/${levelTarget} XP</small></span></div>
      </section>

      <section class="game-layout">
        <aside class="side-panel difficulty-panel">
          <div class="section-title"><span>選擇旅程</span><small>難度</small></div>
          <div class="difficulty-list">
            ${Object.entries(DIFFICULTIES).map(([key, item]) => `
              <button class="difficulty ${game.difficulty === key ? "active" : ""}" data-difficulty="${key}" ${isUnlocked(key) ? "" : "disabled"}>
                <span class="difficulty-icon">${isUnlocked(key) ? item.icon : "🔒"}</span>
                <span><strong>${item.label}</strong><small>${isUnlocked(key) ? `${ADVENTURE_RULES[key].maxHealth} 顆心・+${item.xp} XP` : key === "medium" ? "完成 2 局解鎖" : "完成 5 局解鎖"}</small></span>
              </button>`).join("")}
          </div>
          <button class="alin-mode ${alinMode ? "active" : ""}" id="alin-mode" aria-pressed="${alinMode}">
            <span>🌈</span><span><strong>阿霖模式</strong><small>${alinMode ? "已開啟・不限失誤" : "開啟後不會失敗"}</small></span>
          </button>
          <div class="island-card"><span>🏝️</span><div><strong>我的小島</strong><small>${progress.totalStars} 顆星・完成 ${progress.completedGames} 局</small></div></div>
        </aside>

        <section class="board-card" aria-label="數獨遊戲">
          <div class="game-meta">
            <span class="difficulty-pill">${DIFFICULTIES[game.difficulty].icon} ${DIFFICULTIES[game.difficulty].label}</span>
            <span class="timer-block" aria-label="經過時間，沒有時間限制"><span>⏱ <strong id="timer">${formatTime(game.elapsed)}</strong></span><small>不限時 · ${formatTime(DIFFICULTIES[game.difficulty].bonusTime)} 內 +${DIFFICULTIES[game.difficulty].bonusCoins} 🪙 <i id="freeze-time">${game.frozenSeconds ? `· 凍結 ${game.frozenSeconds}s` : ""}</i></small></span>
            <button class="icon-button" id="restart" aria-label="重新開始">↻</button>
          </div>
          <div class="adventure-status">
            <span class="health">${alinMode ? "🌈 不限失誤" : `${"❤️".repeat(game.health)}${"🤍".repeat(Math.max(0, game.maxHealth - game.health))}`}${game.shields ? ` 🛡️${game.shields}` : ""}</span>
            <div class="goal-chips" aria-label="回血目標">
              <span class="${game.healGoals.streak ? "done" : ""}">連對 8 格</span><span class="${game.healGoals.row ? "done" : ""}">完成一行</span><span class="${game.healGoals.box ? "done" : ""}">完成一宮</span>
            </div>
          </div>
          <div class="sudoku-board" role="grid">
            ${game.values.map((value, index) => {
              const fixed = game.puzzle[index] !== 0;
              const selected = index === game.selected;
              const same = selectedValue && value === selectedValue;
              return `<button class="cell ${fixed ? "fixed" : ""} ${selected ? "selected" : ""} ${related.has(index) ? "related" : ""} ${same ? "same" : ""}" data-cell="${index}" role="gridcell" aria-label="第 ${Math.floor(index / 9) + 1} 列第 ${(index % 9) + 1} 欄${value ? `，數字 ${value}` : "，空白"}">
                ${value || (game.notes[index].length ? `<span class="notes">${Array.from({ length: 9 }, (_, n) => `<i>${game.notes[index].includes(n + 1) ? n + 1 : ""}</i>`).join("")}</span>` : "")}
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
              return `<button data-use-card="${cardId}" ${progress.inventory[cardId] ? "" : "disabled"}><span>${card.icon}</span><small>${card.name} ×${progress.inventory[cardId]}</small></button>`;
            }).join("") : `<small class="empty-loadout">開局前可從背包裝備兩張卡</small>`}
          </div>
        </section>

        <aside class="side-panel reward-panel">
          <div class="section-title"><span>冒險獎勵</span><small>永久累積</small></div>
          <div class="quest"><span class="quest-icon">🎯</span><div><strong>完成一局</strong><small>${Math.min(progress.completedGames, 1)}/1</small><div class="mini-progress"><i style="width:${progress.completedGames ? 100 : 10}%"></i></div></div></div>
          <div class="reward-preview"><span class="chest">🎁</span><strong>過關三選一</strong><small>高星級提高稀有卡機率</small></div>
          <button id="open-backpack-side" class="daily-button">🎒 寶物背包・${inventoryTotal} 張</button>
        </aside>
      </section>
    </main>
    ${game.completed ? completionModal() : game.failed ? failureModal() : showBackpack ? backpackModal() : ""}
  `;
  bindEvents();
}

function completionModal() {
  const totalCoins = Math.ceil(game.xpReward / 5) + game.timeBonus;
  return `<div class="modal-backdrop"><section class="modal completion-modal" role="dialog" aria-modal="true" aria-labelledby="complete-title">
    <div class="celebrate">🎉</div><p class="eyebrow">PUZZLE COMPLETE</p><h2 id="complete-title">太厲害了！</h2>
    <div class="stars-earned" aria-label="獲得 ${game.stars} 顆星">${"⭐".repeat(game.stars)}${"☆".repeat(3 - game.stars)}</div>
    <div class="reward-row"><span>⭐ +${game.xpReward} XP</span><span>🪙 +${totalCoins}</span></div>
    ${game.timeBonus ? `<p class="speed-bonus">⚡ 目標時間內完成，速度獎勵 +${game.timeBonus} 金幣</p>` : `<p class="speed-bonus calm">慢慢玩也很好，關卡沒有時間限制</p>`}
    <div class="card-draw"><strong>${game.remainingClaims ? `選擇 ${game.remainingClaims} 張寶物卡帶走` : "寶物已放進背包"}</strong><div>
      ${game.cardChoices.map((cardId) => {
        const card = TREASURE_CARDS[cardId];
        const claimed = game.claimedCards.includes(cardId);
        return `<button data-claim-card="${cardId}" class="treasure-card ${card.rarity} ${claimed ? "claimed" : ""}" ${claimed || !game.remainingClaims ? "disabled" : ""}><span>${card.icon}</span><strong>${card.name}</strong><small>${card.description}</small></button>`;
      }).join("")}
    </div></div>
    <button id="next-game" class="primary-button" ${game.remainingClaims ? "disabled" : ""}>再玩一局</button>
  </section></div>`;
}

function failureModal() {
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="failure-title">
    <div class="celebrate">🌧️</div><p class="eyebrow">TAKE A BREATH</p><h2 id="failure-title">暫時迷路了</h2><p>可以復活繼續，也可以重新挑戰這一題。</p>
    <div class="failure-actions">
      <button id="revive-card" ${progress.inventory.revive ? "" : "disabled"}>🪶 復活羽毛 ×${progress.inventory.revive}</button>
      <button id="revive-coins" ${progress.coins >= 20 ? "" : "disabled"}>🪙 20 金幣復活</button>
    </div>
    <button id="retry-game" class="primary-button">重新挑戰</button>
  </section></div>`;
}

function backpackModal() {
  const locked = game.actions > 0;
  return `<div class="modal-backdrop"><section class="modal backpack-modal" role="dialog" aria-modal="true" aria-labelledby="backpack-title">
    <div class="celebrate">🎒</div><h2 id="backpack-title">寶物背包</h2><p>${locked ? "本局已開始，下局開始前可重新裝備。" : "選擇最多兩種卡片帶進本局。"}</p>
    <div class="inventory-grid">${Object.entries(TREASURE_CARDS).map(([cardId, card]) => `
      <button data-equip-card="${cardId}" class="inventory-card ${card.rarity} ${equippedCards.includes(cardId) ? "equipped" : ""}" ${locked || !progress.inventory[cardId] ? "disabled" : ""}>
        <span>${card.icon}</span><strong>${card.name} ×${progress.inventory[cardId]}</strong><small>${card.description}</small>
      </button>`).join("")}</div>
    <button id="close-backpack" class="primary-button">完成</button>
  </section></div>`;
}

function bindEvents() {
  document.querySelectorAll("[data-cell]").forEach((button) => button.addEventListener("click", () => { game.selected = Number(button.dataset.cell); render(); }));
  document.querySelectorAll("[data-number]").forEach((button) => button.addEventListener("click", () => enterNumber(Number(button.dataset.number))));
  document.querySelectorAll("[data-difficulty]").forEach((button) => button.addEventListener("click", () => newGame(button.dataset.difficulty)));
  document.querySelectorAll("[data-use-card]").forEach((button) => button.addEventListener("click", () => useCard(button.dataset.useCard)));
  document.querySelectorAll("[data-equip-card]").forEach((button) => button.addEventListener("click", () => toggleEquipCard(button.dataset.equipCard)));
  document.querySelectorAll("[data-claim-card]").forEach((button) => button.addEventListener("click", () => claimCard(button.dataset.claimCard)));
  document.querySelector("#notes")?.addEventListener("click", () => { noteMode = !noteMode; render(); });
  document.querySelector("#alin-mode")?.addEventListener("click", () => { alinMode = !alinMode; render(); });
  document.querySelector("#undo")?.addEventListener("click", clearCell);
  document.querySelector("#hint")?.addEventListener("click", useHint);
  document.querySelector("#restart")?.addEventListener("click", () => newGame(game.difficulty));
  document.querySelector("#next-game")?.addEventListener("click", () => newGame(game.difficulty));
  document.querySelector("#retry-game")?.addEventListener("click", () => newGame(game.difficulty));
  document.querySelector("#revive-card")?.addEventListener("click", reviveWithCard);
  document.querySelector("#revive-coins")?.addEventListener("click", reviveWithCoins);
  document.querySelector("#open-backpack")?.addEventListener("click", openBackpack);
  document.querySelector("#open-backpack-side")?.addEventListener("click", openBackpack);
  document.querySelector("#close-backpack")?.addEventListener("click", () => { showBackpack = false; game.equippedCards = [...equippedCards]; render(); });
}

function openBackpack() {
  showBackpack = true;
  render();
}

function toggleEquipCard(cardId) {
  if (game.actions > 0 || !progress.inventory[cardId]) return;
  if (equippedCards.includes(cardId)) equippedCards = equippedCards.filter((id) => id !== cardId);
  else if (equippedCards.length < 2) equippedCards.push(cardId);
  game.equippedCards = [...equippedCards];
  render();
}

function enterNumber(number) {
  const index = game.selected;
  if (game.completed || game.failed || game.puzzle[index]) return;
  if (noteMode) {
    const notes = new Set(game.notes[index]);
    notes.has(number) ? notes.delete(number) : notes.add(number);
    game.notes[index] = [...notes];
  } else if (game.solution[index] !== number) {
    game.actions += 1;
    game.mistakes += 1;
    game.correctStreak = 0;
    if (!alinMode) {
      if (game.shields) game.shields -= 1;
      else game.health -= 1;
      if (game.health <= 0) {
        game.failed = true;
        clearInterval(timerId);
      }
    }
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
  if (!game.puzzle[game.selected]) {
    game.values[game.selected] = 0;
    game.notes[game.selected] = [];
    render();
  }
}

function healOrShield() {
  if (alinMode) return;
  if (game.health < game.maxHealth) game.health += 1;
  else game.shields += 1;
}

function checkHealGoals() {
  if (!game.healGoals.streak && game.correctStreak >= 8) { game.healGoals.streak = true; healOrShield(); }
  if (!game.healGoals.row) {
    const hasRow = Array.from({ length: 9 }, (_, row) => game.values.slice(row * 9, row * 9 + 9).every(Boolean)).some(Boolean);
    if (hasRow) { game.healGoals.row = true; healOrShield(); }
  }
  if (!game.healGoals.box) {
    const hasBox = Array.from({ length: 9 }, (_, box) => {
      const startRow = Math.floor(box / 3) * 3;
      const startCol = (box % 3) * 3;
      return Array.from({ length: 9 }, (_, offset) => game.values[(startRow + Math.floor(offset / 3)) * 9 + startCol + (offset % 3)]).every(Boolean);
    }).some(Boolean);
    if (hasBox) { game.healGoals.box = true; healOrShield(); }
  }
}

function useHint() {
  const cost = currentHintCost();
  if (game.failed || progress.coins < cost || game.puzzle[game.selected] || game.values[game.selected]) return;
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
  if (!game.equippedCards.includes(cardId) || !progress.inventory[cardId] || game.completed || game.failed) return;
  const index = game.selected;
  if (cardId === "heartPotion") {
    if (alinMode || game.health >= game.maxHealth) return;
    game.health += 1;
  } else if (cardId === "shield") game.shields += 1;
  else if (cardId === "candidateLens") {
    if (game.values[index]) return;
    game.notes[index] = candidatesFor(game.values, index);
  } else if (cardId === "smartHint") {
    if (game.puzzle[index] || game.values[index]) return;
    game.actions += 1;
    game.hintsUsed += 1;
    game.values[index] = game.solution[index];
    removeRelatedNotes(index, game.values[index]);
    checkHealGoals();
    checkCompletion();
  } else if (cardId === "hourglass") game.frozenSeconds += 60;
  else if (cardId === "luckyStar") {
    if (game.xpMultiplier > 1) return;
    game.xpMultiplier = 2;
  } else if (cardId === "treasureKey") {
    if (game.extraCardClaims) return;
    game.extraCardClaims = 1;
  } else if (cardId === "revive") return;
  progress = consumeCard(progress, cardId);
  game.usedCards.push(cardId);
  render();
}

function reviveWithCard() {
  if (!progress.inventory.revive) return;
  progress = consumeCard(progress, "revive");
  resumeAfterRevive();
}

function reviveWithCoins() {
  if (progress.coins < 20) return;
  progress = spendCoins(progress, 20);
  resumeAfterRevive();
}

function resumeAfterRevive() {
  game.failed = false;
  game.health = Math.min(2, game.maxHealth);
  startTimer();
  render();
}

function claimCard(cardId) {
  if (!game.completed || !game.remainingClaims || game.claimedCards.includes(cardId) || !game.cardChoices.includes(cardId)) return;
  progress = addCard(progress, cardId);
  game.claimedCards.push(cardId);
  game.remainingClaims -= 1;
  render();
}

function checkCompletion() {
  if (game.completed || !game.values.every((value, index) => value === game.solution[index])) return;
  game.completed = true;
  clearInterval(timerId);
  const reward = DIFFICULTIES[game.difficulty];
  game.stars = calculateStars(game);
  game.xpReward = reward.xp * game.xpMultiplier;
  game.timeBonus = game.elapsed <= reward.bonusTime ? reward.bonusCoins : 0;
  game.cardChoices = drawTreasureCards(game.stars);
  game.remainingClaims = 1 + game.extraCardClaims;
  progress = rewardProgress(progress, game.xpReward, game.timeBonus, game.stars);
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    if (game.frozenSeconds > 0) game.frozenSeconds -= 1;
    else game.elapsed += 1;
    const timer = document.querySelector("#timer");
    const freeze = document.querySelector("#freeze-time");
    if (timer) timer.textContent = formatTime(game.elapsed);
    if (freeze) freeze.textContent = game.frozenSeconds ? `· 凍結 ${game.frozenSeconds}s` : "";
  }, 1000);
}

function newGame(difficulty) {
  clearInterval(timerId);
  game = createGame(difficulty);
  noteMode = false;
  showBackpack = false;
  setupAdventure();
  startTimer();
  render();
}

document.addEventListener("keydown", (event) => {
  if (/^[1-9]$/.test(event.key)) enterNumber(Number(event.key));
  if (["Backspace", "Delete", "0"].includes(event.key)) clearCell();
  if (event.key.toLowerCase() === "n") { noteMode = !noteMode; render(); }
});

newGame("easy");

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register(new URL("sw.js", document.baseURI)).catch(() => {});
}
