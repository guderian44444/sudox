import { createGame, DIFFICULTIES, relatedCells } from "./game/sudoku.js";
import { loadProgress, rewardProgress, saveProgress } from "./state/store.js";

const app = document.querySelector("#app");
let progress = loadProgress();
let game = createGame("easy");
let noteMode = false;
let timerId;

const unlockOrder = ["easy", "medium", "hard"];
const isUnlocked = (difficulty) => unlockOrder.indexOf(difficulty) <= unlockOrder.indexOf(progress.unlockedDifficulty);
const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

function mascot() {
  return `<div class="mascot" aria-hidden="true"><span class="ear left"></span><span class="ear right"></span><span class="face">•ᴗ•</span></div>`;
}

function render() {
  const levelTarget = progress.level * 100;
  const selectedValue = game.values[game.selected];
  const related = relatedCells(game.selected);
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div class="brand">${mascot()}<div><span>數獨島</span><small>SUDOX ADVENTURE</small></div></div>
        <div class="wallet" aria-label="玩家資源"><span>🔥 ${progress.streak}</span><span>🪙 ${progress.coins}</span></div>
      </header>

      <section class="hero-card">
        <div>
          <p class="eyebrow">LEVEL ${progress.level}</p>
          <h1>今天也來解一題吧！</h1>
          <p>每完成一局，就讓小島長大一點。</p>
        </div>
        <div class="level-ring" style="--progress:${Math.round((progress.xp / levelTarget) * 360)}deg"><span>${progress.xp}<small>/${levelTarget} XP</small></span></div>
      </section>

      <section class="game-layout">
        <aside class="side-panel difficulty-panel">
          <div class="section-title"><span>選擇旅程</span><small>難度</small></div>
          <div class="difficulty-list">
            ${Object.entries(DIFFICULTIES).map(([key, item]) => `
              <button class="difficulty ${game.difficulty === key ? "active" : ""}" data-difficulty="${key}" ${isUnlocked(key) ? "" : "disabled"}>
                <span class="difficulty-icon">${isUnlocked(key) ? item.icon : "🔒"}</span>
                <span><strong>${item.label}</strong><small>${isUnlocked(key) ? `完成 +${item.xp} XP` : key === "medium" ? "完成 2 局解鎖" : "完成 5 局解鎖"}</small></span>
              </button>`).join("")}
          </div>
          <div class="island-card"><span>🏝️</span><div><strong>我的小島</strong><small>已完成 ${progress.completedGames} 局</small></div></div>
        </aside>

        <section class="board-card" aria-label="數獨遊戲">
          <div class="game-meta">
            <span class="difficulty-pill">${DIFFICULTIES[game.difficulty].icon} ${DIFFICULTIES[game.difficulty].label}</span>
            <span aria-label="經過時間">⏱ <strong id="timer">${formatTime(game.elapsed)}</strong></span>
            <button class="icon-button" id="restart" aria-label="重新開始">↻</button>
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
            <button id="hint"><span>💡</span><small>提示 -${DIFFICULTIES[game.difficulty].hintCost}</small></button>
          </div>
          <div class="number-pad" aria-label="數字鍵盤">
            ${Array.from({ length: 9 }, (_, index) => `<button data-number="${index + 1}">${index + 1}</button>`).join("")}
          </div>
          <p class="mistakes">小心心 ${"❤️".repeat(Math.max(0, 3 - game.mistakes))}${"🤍".repeat(Math.min(3, game.mistakes))}</p>
        </section>

        <aside class="side-panel reward-panel">
          <div class="section-title"><span>冒險獎勵</span><small>今日進度</small></div>
          <div class="quest"><span class="quest-icon">🎯</span><div><strong>完成一局</strong><small>${Math.min(progress.completedGames, 1)}/1</small><div class="mini-progress"><i style="width:${progress.completedGames ? 100 : 10}%"></i></div></div></div>
          <div class="reward-preview"><span class="chest">🎁</span><strong>下一級寶箱</strong><small>升級可獲得 25 枚金幣</small></div>
          <button class="daily-button" disabled>✨ 每日挑戰・即將開放</button>
        </aside>
      </section>
    </main>
    ${game.completed ? completionModal() : ""}
  `;
  bindEvents();
}

function completionModal() {
  const reward = DIFFICULTIES[game.difficulty];
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="complete-title">
    <div class="celebrate">🎉</div><p class="eyebrow">PUZZLE COMPLETE</p><h2 id="complete-title">太厲害了！</h2>
    <p>你讓數獨島又閃亮了一點。</p>
    <div class="reward-row"><span>⭐ +${reward.xp} XP</span><span>🪙 +${Math.ceil(reward.xp / 5)}</span></div>
    <button id="next-game" class="primary-button">再玩一局</button>
  </section></div>`;
}

function bindEvents() {
  document.querySelectorAll("[data-cell]").forEach((button) => button.addEventListener("click", () => {
    game.selected = Number(button.dataset.cell);
    render();
  }));
  document.querySelectorAll("[data-number]").forEach((button) => button.addEventListener("click", () => enterNumber(Number(button.dataset.number))));
  document.querySelectorAll("[data-difficulty]").forEach((button) => button.addEventListener("click", () => newGame(button.dataset.difficulty)));
  document.querySelector("#notes")?.addEventListener("click", () => { noteMode = !noteMode; render(); });
  document.querySelector("#undo")?.addEventListener("click", clearCell);
  document.querySelector("#hint")?.addEventListener("click", useHint);
  document.querySelector("#restart")?.addEventListener("click", () => newGame(game.difficulty));
  document.querySelector("#next-game")?.addEventListener("click", () => newGame(game.difficulty));
}

function enterNumber(number) {
  const index = game.selected;
  if (game.completed || game.puzzle[index]) return;
  if (noteMode) {
    const notes = new Set(game.notes[index]);
    notes.has(number) ? notes.delete(number) : notes.add(number);
    game.notes[index] = [...notes];
  } else if (game.solution[index] !== number) {
    game.mistakes += 1;
    document.body.classList.add("shake");
    setTimeout(() => document.body.classList.remove("shake"), 320);
    if (game.mistakes >= 3) newGame(game.difficulty);
  } else {
    game.values[index] = number;
    game.notes[index] = [];
    removeRelatedNotes(index, number);
    checkCompletion();
  }
  render();
}

function removeRelatedNotes(index, number) {
  relatedCells(index).forEach((cell) => {
    game.notes[cell] = game.notes[cell].filter((note) => note !== number);
  });
}

function clearCell() {
  if (!game.puzzle[game.selected]) {
    game.values[game.selected] = 0;
    game.notes[game.selected] = [];
    render();
  }
}

function useHint() {
  const cost = DIFFICULTIES[game.difficulty].hintCost;
  if (progress.coins < cost || game.puzzle[game.selected]) return;
  progress.coins -= cost;
  game.values[game.selected] = game.solution[game.selected];
  removeRelatedNotes(game.selected, game.values[game.selected]);
  saveProgress(progress);
  checkCompletion();
  render();
}

function checkCompletion() {
  if (!game.values.every((value, index) => value === game.solution[index])) return;
  game.completed = true;
  clearInterval(timerId);
  progress = rewardProgress(progress, DIFFICULTIES[game.difficulty].xp);
}

function newGame(difficulty) {
  clearInterval(timerId);
  game = createGame(difficulty);
  noteMode = false;
  timerId = setInterval(() => {
    game.elapsed += 1;
    const timer = document.querySelector("#timer");
    if (timer) timer.textContent = formatTime(game.elapsed);
  }, 1000);
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
