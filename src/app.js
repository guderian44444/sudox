import { createGame, DIFFICULTIES, relatedCells } from "./game/sudoku.js";
import { activateAutomaticTreasures, ADVENTURE_RULES, applyHintTreasure, applyImmediateTreasure, calculateStars, completedSudokuUnits, drawTreasureCards, newlyCompletedSudokuUnits, strongestEquippedRevive, sudokuUnitCells, treasureClaimsForFloor, TREASURE_AUTO_EFFECTS, TREASURE_CARDS } from "./game/adventure.js";
import { ACHIEVEMENTS, achievementValue, recordAchievementGame } from "./game/achievements.js";
import { chooseFriendPair, chooseGardenEel } from "./game/friends.js";
import { cloudConfigured, loadCloudPin, loadCloudProgress, normalizePlayerName, renameCloudPlayer, saveCloudPin, saveCloudProgress, validCloudPin } from "./state/cloud.js";
import { buildScore, fetchLeaderboard, flushPendingScores, leaderboardConfigured, normalizeLeaderboardTaunt, pendingScoreCount, queueLeaderboardScore, updateLeaderboardAvatar, updateLeaderboardTaunt } from "./state/leaderboard.js";
import { addCard, clearSession, consumeCard, exportSaveCode, importSaveCode, loadProgress, loadSession, rewardProgress, saveProgress, saveSession, spendCoins } from "./state/store.js";

const app = document.querySelector("#app");
let progress = loadProgress();
const migratedAchievements = recordAchievementGame(progress);
progress = migratedAchievements.progress;
if (migratedAchievements.unlocked.length) saveProgress(progress);
const restoredSession = loadSession();
let game = restoredSession?.game || createGame("easy");
if (restoredSession && typeof game.started !== "boolean") game.started = true;
if (restoredSession) {
  const restoredCompletedUnits = completedSudokuUnits(game.values);
  if (!game.completedUnits) game.completedUnits = restoredCompletedUnits;
  else if (!Array.isArray(game.completedUnits.columns)) game.completedUnits.columns = restoredCompletedUnits.columns;
  if (!Array.isArray(game.milestones)) game.milestones = [];
}
let noteMode = false;
let alinMode = restoredSession?.alinMode || false;
let showBackpack = false;
let showSaveCenter = false;
let showNameSetup = !progress.playerName;
let showLeaderboard = false;
let showAchievements = false;
let showAvatarPicker = false;
let leaderboardDifficulty = game.difficulty;
let leaderboardRows = [];
let leaderboardStatus = "";
let leaderboardTauntStatus = "";
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
let lastWaveVariants = { row: null, column: null, box: null };
const SOUND_KEY = "sudox-sound-enabled-v1";
let soundEnabled = localStorage.getItem(SOUND_KEY) !== "off";
let audioContext = null;
let lastFinaleMelody = -1;
let lastFriendPairKey = "";

const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const LEADERBOARD_MODES = Object.freeze({
  easy: { icon: DIFFICULTIES.easy.icon, label: DIFFICULTIES.easy.label },
  medium: { icon: DIFFICULTIES.medium.icon, label: DIFFICULTIES.medium.label },
  hard: { icon: DIFFICULTIES.hard.icon, label: DIFFICULTIES.hard.label },
  alin: { icon: "🌈", label: "阿霖" }
});
const RUN_MILESTONES = Object.freeze([
  { id: "streak15", icon: "🔥", name: "靈感連線", detail: "連續答對 15 格", test: (current) => current.correctStreak >= 15 },
  { id: "filled60", icon: "🧩", name: "拼圖成形", detail: "本局盤面填滿 60 格", test: (current) => current.values.filter(Boolean).length >= 60 },
  { id: "rows3", icon: "↔️", name: "橫行小隊", detail: "完成 3 條橫行", test: (current) => current.completedUnits.rows.length >= 3 },
  { id: "columns3", icon: "↕️", name: "直列登山隊", detail: "完成 3 條縱列", test: (current) => current.completedUnits.columns.length >= 3 },
  { id: "boxes3", icon: "🏘️", name: "九宮守護者", detail: "完成 3 個九宮格", test: (current) => current.completedUnits.boxes.length >= 3 },
  { id: "units8", icon: "🏝️", name: "半島點燈", detail: "累計完成 8 個行、列或宮", test: (current) => current.completedUnits.rows.length + current.completedUnits.columns.length + current.completedUnits.boxes.length >= 8 },
  { id: "lastNine", icon: "🚩", name: "最後衝刺", detail: "盤面只剩最後 9 格", test: (current) => current.values.filter(Boolean).length >= 72 }
]);
const AVATAR_ANIMALS = Object.freeze([
  { id: "cat", emoji: "🐱", name: "貓" },
  { id: "dog", emoji: "🐶", name: "狗" },
  { id: "mouse", emoji: "🐭", name: "老鼠" },
  { id: "hamster", emoji: "🐹", name: "倉鼠" },
  { id: "rabbit", emoji: "🐰", name: "兔子" },
  { id: "fox", emoji: "🦊", name: "狐狸" },
  { id: "bear", emoji: "🐻", name: "熊" },
  { id: "panda", emoji: "🐼", name: "熊貓" },
  { id: "koala", emoji: "🐨", name: "無尾熊" },
  { id: "tiger", emoji: "🐯", name: "老虎" },
  { id: "lion", emoji: "🦁", name: "獅子" },
  { id: "frog", emoji: "🐸", name: "青蛙" },
  { id: "pig", emoji: "🐷", name: "豬" },
  { id: "cow", emoji: "🐮", name: "牛" },
  { id: "monkey", emoji: "🐵", name: "猴子" },
  { id: "chicken", emoji: "🐔", name: "雞" },
  { id: "penguin", emoji: "🐧", name: "企鵝" },
  { id: "whale", emoji: "🐳", name: "鯨魚" },
  { id: "dolphin", emoji: "🐬", name: "海豚" },
  { id: "owl", emoji: "🦉", name: "貓頭鷹" },
  { id: "duck", emoji: "🦆", name: "鴨子" },
  { id: "bunny", emoji: "🐇", name: "野兔" },
  { id: "deer", emoji: "🦌", name: "鹿" },
  { id: "panda_face", emoji: "🐼", name: "熊貓臉" }
]);
const AVATAR_COLORS = Object.freeze([
  { hue: "0deg", bg: "#fff0d4", name: "原色" },
  { hue: "45deg", bg: "#fff8d0", name: "金黃" },
  { hue: "90deg", bg: "#d4ffd4", name: "鮮綠" },
  { hue: "160deg", bg: "#d0f0ff", name: "天藍" },
  { hue: "210deg", bg: "#d0d4ff", name: "靛藍" },
  { hue: "270deg", bg: "#e8d0ff", name: "紫羅蘭" },
  { hue: "320deg", bg: "#ffd0e0", name: "玫紅" },
  { hue: "350deg", bg: "#ffd4d4", name: "櫻粉" }
]);
const AVATAR_FACES = {
  idle: ["•ᴗ•", "(◕ᴗ◕)", "◕‿◕", "(´・ω・`)"],
  happy: ["✧ω✧", "(≧▽≦)", "(ﾉ◕ヮ◕)ﾉ*:・ﾟ✧", "☆⌒(｡◕‿◕｡)⌒☆", "(≧∇≦)ﾉ"],
  sad: ["×_×", "(；￣Д￣)", "T_T", "(＞﹏＜)", "qwq"],
  thinking: ["(・ω・;)","(？ω？)", "(⊙_⊙)", "Hmm..."],
  excited: ["(★^O^★)", "(≧∇≦)ﾉ", "ヾ(✿ﾟ▽ﾟ)ノ", "(☆▽☆)"],
  proud: ["(￣▽￣*)ゞ", "(^▽^)", "(✪ω✪)", "哼♪"],
  embarrassed: ["(⁄ ⁄•⁄ω⁄•⁄ ⁄)", "(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)", "Σ(っ °Д °;)っ"],
  determined: ["(｀・ω・´)", "(＞﹏＜)→(｀・ω・´)", "嗶嗶!"],
  tired: ["(´-ω-`)", "z_z...", "(─.─;)"],
  shocked: ["Σ(°△°|||)", "!!!(⊙_⊙!!)", "What?!"],
  love: ["(♡ω♡)", "(♥‿♥)", "♡( ◡‿◡ )"],
  mischievous: ["(๑•̀ㅂ•́)و✧", "✧*。. ( ˃ ⌑ ˂ഃ )", "哼~"]
};
let avatarFace = "idle";
let avatarFaceIndex = 0;
let avatarFaceTimer;

function getAvatarFace() {
  const faces = AVATAR_FACES[avatarFace] || AVATAR_FACES.idle;
  return faces[avatarFaceIndex % faces.length];
}

function setAvatarFace(face, duration = 2000) {
  clearTimeout(avatarFaceTimer);
  avatarFace = face;
  avatarFaceIndex++;
  avatarFaceTimer = setTimeout(() => { avatarFace = "idle"; }, duration);
}
const currentHintCost = () => alinMode ? 0 : DIFFICULTIES[game.difficulty].hintCost;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const normalizePinInput = (value) => String(value)
  .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xFF10))
  .replace(/\D/g, "")
  .slice(0, 4);

function playSound(name) {
  if (!soundEnabled) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audioContext ||= new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  const sounds = {
    toggle: [[660, 0, .08], [880, .08, .1]],
    correct: [[620, 0, .055]],
    success: [[523, 0, .1], [659, .09, .1], [784, .18, .13]],
    "row-0": [[523, 0, .08], [659, .1, .08], [784, .2, .12]],
    "row-1": [[784, 0, .08], [659, .1, .08], [880, .2, .12]],
    "column-0": [[440, 0, .08], [587, .09, .08], [880, .18, .14]],
    "column-1": [[880, 0, .08], [587, .1, .08], [698, .2, .13]],
    "box-0": [[523, 0, .07], [659, .08, .07], [784, .16, .07], [1047, .24, .14]],
    "box-1": [[784, 0, .07], [988, .08, .07], [659, .16, .07], [880, .24, .14]],
    mistake: [[330, 0, .11], [247, .1, .18]],
    failure: [[392, 0, .1], [294, .11, .12], [196, .24, .24]],
    revive: [[330, 0, .08], [494, .09, .08], [659, .18, .1], [988, .3, .2]],
    shield: [[740, 0, .06], [1110, .07, .16]],
    card: [[392, 0, .07], [523, .07, .07], [784, .14, .16]],
    "finale-0": [[523, 0, .11], [659, .11, .11], [784, .22, .12], [1047, .36, .3]],
    "finale-1": [[659, 0, .1], [784, .1, .1], [988, .2, .14], [784, .35, .1], [1175, .47, .28]],
    "finale-2": [[392, 0, .1], [523, .1, .1], [659, .2, .1], [784, .3, .1], [1047, .43, .32]]
  };
  const sequence = sounds[name] || sounds.success;
  const start = audioContext.currentTime;
  sequence.forEach(([frequency, delay, duration], index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = index % 2 ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, start + delay);
    gain.gain.setValueAtTime(.0001, start + delay);
    gain.gain.exponentialRampToValueAtTime(.055, start + delay + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, start + delay + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start + delay);
    oscillator.stop(start + delay + duration + .02);
  });
}

function playFinaleMelody() {
  const choices = [0, 1, 2].filter((index) => index !== lastFinaleMelody);
  lastFinaleMelody = choices[Math.floor(Math.random() * choices.length)];
  playSound(`finale-${lastFinaleMelody}`);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
  render();
  if (soundEnabled) playSound("toggle");
}

function mascot() {
  return `<div class="mascot" aria-hidden="true"><span class="ear left"></span><span class="ear right"></span><span class="face">•ᴗ•</span></div>`;
}

function getAvatarEmoji() {
  const animal = AVATAR_ANIMALS.find(a => a.id === progress.playerAvatar);
  return animal ? animal.emoji : "❓";
}

function triggerAvatarAnim(anim) {
  const el = document.querySelector(".player-avatar");
  if (!el) return;
  el.classList.remove("shake", "jump");
  void el.offsetWidth;
  el.classList.add(anim);
  el.addEventListener("animationend", () => el.classList.remove(anim), { once: true });
  setTimeout(() => el.classList.remove(anim), 800);
}

function avatarMarkup(rank, row) {
  const hasLeaderboardRow = Boolean(row);
  const avatar = hasLeaderboardRow ? row.player_avatar : progress.playerAvatar;
  const color = hasLeaderboardRow ? (row.avatar_color != null ? row.avatar_color : 0) : (progress.avatarColor || 0);
  if (!avatar) {
    const crown = rank === 0 ? "👑" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : "";
    if (crown) return `<div class="player-avatar leaderboard-crown"><span>${crown}</span></div>`;
    return "";
  }
  const animal = AVATAR_ANIMALS.find(a => a.id === avatar);
  const emoji = animal ? animal.emoji : "❓";
  const colorDef = AVATAR_COLORS[color] || AVATAR_COLORS[0];
  const face = getAvatarFace();
  const crown = rank === 0 ? "👑" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : "";
  return `<div class="player-avatar" style="--avatar-hue:${colorDef.hue}" data-animal="${avatar}"><span>${crown}${emoji}</span><em class="avatar-bubble">${face}</em></div>`;
}

function animatedFriendsMarkup() {
  const selection = chooseFriendPair(lastFriendPairKey);
  lastFriendPairKey = selection.key;
  const animal = ({ id, name, face }) => `<span class="animated-animal ${id}" title="${name}">
    <i class="animal-tail"></i><i class="animal-leg left"></i><i class="animal-leg right"></i><i class="animal-body"></i>
    <i class="animal-arm left"></i><i class="animal-arm right"></i>
    <i class="animal-head"><b class="animal-ear left"></b><b class="animal-ear right"></b><em>${face}</em></i>
  </span>`;
  return `<span class="animated-friends">${selection.friends.map(animal).join("")}</span>`;
}

function showGardenEel() {
  const board = document.querySelector(".sudoku-board");
  if (!board || !game.started || game.completed || game.failed) return;
  const { cell, variant } = chooseGardenEel();
  const eel = document.createElement("span");
  eel.className = `garden-eel-peek ${variant}`;
  eel.style.left = `${((cell % 9) / 9) * 100}%`;
  eel.style.top = `${(Math.floor(cell / 9) / 9) * 100}%`;
  eel.setAttribute("title", variant === "orange" ? "橘色花園鰻偷看一下" : "白色花園鰻偷看一下");
  const eelImg = new URL(variant === "orange" ? "../public/assets/eel-orange.png" : "../public/assets/eel-white.png", import.meta.url).href;
  eel.innerHTML = `<i class="garden-eel-creature"><img class="garden-eel-img" src="${eelImg}" alt="花園鰻" aria-hidden="true"/></i>`;
  board.append(eel);
  eel.addEventListener("animationend", () => eel.remove(), { once: true });
  setTimeout(() => eel.remove(), 2600);
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

function showGameEffect(icon, title, detail, tone = "success", motion = "") {
  gameEffectQueue.push({ icon, title, detail, tone, motion });
  playNextGameEffect();
}

function playNextGameEffect() {
  if (gameEffectActive || !gameEffectQueue.length) return;
  gameEffectActive = true;
  const { icon, title, detail, tone, motion } = gameEffectQueue.shift();
  const hasFriends = icon === "friends";
  const effect = document.createElement("section");
  effect.className = `game-effect ${tone}${hasFriends ? " has-friends" : ""}${motion ? ` motion-${motion}` : ""}`;
  effect.setAttribute("role", "status");
  effect.setAttribute("aria-live", "polite");
  effect.innerHTML = `
    <span class="effect-spark one">✦</span><span class="effect-spark two">●</span><span class="effect-spark three">✦</span>
    <div class="effect-character" aria-hidden="true">${hasFriends ? animatedFriendsMarkup() : icon}</div>
    <div class="effect-bubble"><strong>${title}</strong><small>${detail}</small></div>
    <span class="effect-spark four">●</span><span class="effect-spark five">✦</span>`;
  document.body.append(effect);
  playSound(motion || tone);
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
  const previous = lastWaveVariants[type];
  const variant = previous === null ? (Math.random() < 0.5 ? 0 : 1) : 1 - previous;
  lastWaveVariants[type] = variant;
  cellWaveQueue.push({ type, variant, cells: sudokuUnitCells(type, unitIndex, variant) });
  return variant;
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
    cell.classList.add("wave-hop", `wave-${wave.type}`, `wave-variant-${wave.variant}`);
  });
  setTimeout(() => {
    cells.forEach((cell) => {
      cell.classList.remove("wave-hop", "wave-row", "wave-column", "wave-box", "wave-variant-0", "wave-variant-1");
      cell.style.removeProperty("--wave-delay");
    });
    cellWaveActive = false;
    playNextCellWave();
  }, 1350);
}

function showFinaleCelebration() {
  document.querySelector(".finale-overlay")?.remove();
  cellWaveQueue = [];
  const finale = document.createElement("section");
  finale.className = "finale-overlay";
  finale.setAttribute("role", "status");
  finale.setAttribute("aria-live", "assertive");
  const colors = ["#f47f62", "#ffd15c", "#56c9a5", "#69aee8", "#b78ade", "#ff9cc2"];
  const confetti = Array.from({ length: 48 }, (_, index) => {
    const left = (index * 37) % 100;
    const delay = (index % 12) * 0.07;
    const duration = 1.55 + (index % 7) * 0.13;
    const color = colors[index % colors.length];
    return `<i style="--confetti-left:${left}%;--confetti-delay:${delay}s;--confetti-duration:${duration}s;--confetti-color:${color};--confetti-rotation:${(index * 47) % 180}deg"></i>`;
  }).join("");
  const numbers = game.values.map((value, index) => `<span style="--finale-direction:${index % 2 ? 1 : -1}">${value}</span>`).join("");
  finale.innerHTML = `
    <div class="finale-glow"></div>
    <div class="finale-confetti" aria-hidden="true">${confetti}</div>
    <div class="finale-stage">
      <div class="finale-friends" aria-hidden="true">${animatedFriendsMarkup()}</div>
      <strong>全盤完成！一起跳舞吧！</strong>
      <div class="finale-board" aria-hidden="true">${numbers}</div>
      <small>阿霖的數獨島・完美過關</small>
    </div>`;
  document.body.append(finale);
  playFinaleMelody();
  setTimeout(() => finale.classList.add("leaving"), 2850);
  setTimeout(() => finale.remove(), 3400);
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
    completedUnits: { rows: [], columns: [], boxes: [] },
    milestones: [],
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
  lastWaveVariants = { row: null, column: null, box: null };
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
    <main class="shell ${game.started ? "game-active" : ""}">
      <header class="topbar">
        <div class="brand">${mascot()}<div><span>阿霖的數獨島</span><small>ALIN'S SUDOKU ISLAND</small></div></div>
        <div class="topbar-actions"><div class="wallet" aria-label="玩家資源"><span>⭐ ${progress.totalStars}</span><span>🪙 ${progress.coins}</span></div><button id="toggle-sound" class="save-button sound-button" aria-label="${soundEnabled ? "關閉音效" : "開啟音效"}" aria-pressed="${soundEnabled}">${soundEnabled ? "🔊" : "🔇"}</button><button id="open-avatar-picker" class="save-button">🐾 <span>頭像</span></button><button id="open-leaderboard" class="save-button">🏆 <span>排行</span></button><button id="open-save-center" class="save-button">💾 <span>存檔</span></button></div>
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
              <button class="difficulty ${game.difficulty === key ? "active" : ""}" data-difficulty="${key}" ${game.started ? "disabled" : ""}>
                <span class="difficulty-icon">${item.icon}</span>
                <span><strong>${item.label}</strong><small>${ADVENTURE_RULES[key].maxHealth} 心・${item.xp} XP・${ADVENTURE_RULES[key].treasurePoolSize} 種寶物</small></span>
              </button>`).join("")}
          </div>
          <div class="difficulty-summary">🌱 35 XP／10 種　🌼 60 XP／30 種　🏆 100 XP／60 種</div>
          <button class="alin-mode ${alinMode ? "active" : ""}" id="alin-mode" aria-pressed="${alinMode}" ${game.started ? "disabled" : ""}>
            <span>🌈</span><span><strong>阿霖模式</strong><small>${game.started ? (alinMode ? "本局已鎖定・不限失誤" : "本局已鎖定・下局可開啟") : (alinMode ? "已開啟・不限失誤" : "開啟後不會失敗")}</small></span>
          </button>
          <button class="island-card" id="open-achievements-side"><span>🏝️</span><div><strong>我的小島與成就</strong><small>${progress.achievements?.length || 0}/${ACHIEVEMENTS.length} 個・${progress.totalStars} 顆星</small></div></button>
        </aside>

        <section class="board-card" aria-label="數獨遊戲">
          <div class="board-buddies" aria-hidden="true"><span class="cat-buddy">🐱</span><span class="otter-buddy">🦦</span><span class="mouse-buddy">🐭</span></div>
          ${avatarMarkup()}
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
            <span class="run-milestone-badge">🏅 本局 ${game.milestones?.length || 0}/${RUN_MILESTONES.length}</span>
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
    ${showNameSetup ? nameSetupModal() : showLeaderboard ? leaderboardModal() : showAchievements ? achievementModal() : showSaveCenter ? saveCenterModal() : showBackpack ? backpackModal() : showAvatarPicker ? avatarPickerModal() : !game.started ? startModal() : game.completed ? completionModal() : game.failed ? failureModal() : ""}
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
    <button id="open-start-achievements" class="secondary-button achievement-button">🏅 查看成就圖鑑</button>
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

function achievementModal() {
  const unlocked = new Set(progress.achievements || []);
  const stats = progress.achievementStats || {};
  return `<div class="modal-backdrop"><section class="modal achievement-modal" role="dialog" aria-modal="true" aria-labelledby="achievement-title">
    <div class="celebrate">🏅</div><h2 id="achievement-title">小島成就圖鑑</h2>
    <p>永久成就只需解鎖一次，獎勵會直接加入金幣。</p>
    <div class="achievement-summary"><span>🎮 ${progress.completedGames} 局</span><span>💎 ${stats.perfectGames || 0} 完美</span><span>⚡ ${stats.speedGames || 0} 速解</span><span>🌈 ${stats.alinGames || 0} 阿霖</span></div>
    <div class="achievement-grid">${ACHIEVEMENTS.map((achievement) => {
      const done = unlocked.has(achievement.id);
      const value = achievementValue(progress, achievement);
      return `<article class="achievement-card ${done ? "unlocked" : "locked"}"><span>${done ? achievement.icon : "🔒"}</span><div><strong>${achievement.name}</strong><small>${achievement.description}</small><i><b style="width:${Math.round(value / achievement.target * 100)}%"></b></i><em>${value}/${achievement.target}・🪙 ${achievement.coins}</em></div></article>`;
    }).join("")}</div>
    <button id="close-achievements" class="primary-button">回到遊戲</button>
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
  const myRow = leaderboardRows.find((row) => row.player_id === progress.playerId);
  return `<div class="modal-backdrop"><section class="modal leaderboard-modal" role="dialog" aria-modal="true" aria-labelledby="leaderboard-title">
    <div class="celebrate">🏆</div><h2 id="leaderboard-title">家庭全球排行</h2>
    <div class="leaderboard-tabs">${Object.entries(LEADERBOARD_MODES).map(([key, item]) => `<button data-rank-difficulty="${key}" class="${leaderboardDifficulty === key ? "active" : ""}">${item.icon} ${item.label}</button>`).join("")}</div>
    ${!configured ? `<div class="empty-ranking"><strong>尚未連接資料庫</strong><small>設定 Supabase 後，家人的成績會出現在這裡。</small></div>` : leaderboardStatus ? `<div class="empty-ranking"><span class="loading-orbit">☁️</span><small>${escapeHtml(leaderboardStatus)}</small></div>` : leaderboardRows.length ? `<div class="leaderboard-list">${leaderboardRows.map((row, index) => `
      <div class="leaderboard-row ${row.player_id === progress.playerId ? "mine" : ""}"><b>${index + 1}</b>${avatarMarkup(index, row)}<span class="leaderboard-player"><strong>${escapeHtml(row.player_name)}</strong><small>${row.stars}⭐・${row.mistakes} 次失誤・${formatTime(row.elapsed_seconds)}</small>${row.taunt ? `<q>${escapeHtml(row.taunt)}</q>` : `<q class="quiet">還沒有留下嗆聲</q>`}</span><em>第 ${row.floor} 層</em></div>`).join("")}</div>` : `<div class="empty-ranking"><strong>還沒有成績</strong><small>完成第一層就能成為榜首！</small></div>`}
    ${configured ? `<div class="taunt-editor"><label for="leaderboard-taunt">📣 我的島主宣言</label><div><input id="leaderboard-taunt" maxlength="48" value="${escapeHtml(myRow?.taunt || "")}" placeholder="例如：榜首先借我坐一下！"><button id="save-leaderboard-taunt" ${myRow ? "" : "disabled"}>送出</button></div><small>${escapeHtml(leaderboardTauntStatus || (myRow ? "最多 48 字，所有玩家都看得到" : "完成一局上榜後就能留言"))}</small></div>` : ""}
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
    <div class="rename-player"><label for="rename-player-name">✏️ 修改玩家名稱</label><div><input id="rename-player-name" maxlength="16" value="${escapeHtml(progress.playerName || "")}" placeholder="新的玩家名稱"><button id="rename-cloud-player" ${configured && pinReady && progress.playerName ? "" : "disabled"}>改名</button></div><small>使用目前的家庭 PIN 驗證，排行榜名稱也會一起更新。</small></div>
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

function avatarPickerModal() {
  const selectedAnimal = progress.playerAvatar;
  const selectedColor = progress.avatarColor;
  const animal = AVATAR_ANIMALS.find(a => a.id === selectedAnimal);
  const color = AVATAR_COLORS[selectedColor] || AVATAR_COLORS[0];
  return `<div class="modal-backdrop"><section class="modal avatar-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-title">
    <div class="celebrate">🐾</div><h2 id="avatar-title">選擇你的動物頭像</h2>
    <p>選一個動物代表你，在遊戲中會陪你一起解數獨！</p>
    <div class="avatar-preview" style="filter: hue-rotate(${color.hue})">${animal ? animal.emoji : "❓"}</div>
    <div class="avatar-picker-grid">${AVATAR_ANIMALS.map(a => `
      <button data-pick-animal="${a.id}" class="avatar-picker-animal ${selectedAnimal === a.id ? "selected" : ""}">
        <span>${a.emoji}</span><small>${a.name}</small>
      </button>`).join("")}</div>
    ${selectedAnimal ? `<div class="avatar-color-row">${AVATAR_COLORS.map((c, i) => `
      <button data-pick-color="${i}" class="avatar-color-dot ${selectedColor === i ? "selected" : ""}" style="background:${c.bg}" title="${c.name}" aria-label="${c.name}色"></button>`).join("")}</div>` : ""}
    <button id="close-avatar-picker" class="primary-button" ${selectedAnimal ? "" : "disabled"}>${selectedAnimal ? "完成" : "請先選擇動物"}</button>
  </section></div>`;
}

function syncLeaderboardAvatar() {
  const pin = loadCloudPin();
  if (!leaderboardConfigured() || !validCloudPin(pin) || !progress.playerAvatar) return;
  updateLeaderboardAvatar({ playerId: progress.playerId, pin, avatar: progress.playerAvatar, color: progress.avatarColor }).catch(() => {});
}

function bindEvents() {
  document.querySelectorAll("[data-cell]").forEach((button) => button.addEventListener("click", () => { game.selected = Number(button.dataset.cell); render(); }));
  document.querySelectorAll("[data-number]").forEach((button) => button.addEventListener("click", () => enterNumber(Number(button.dataset.number))));
  document.querySelectorAll("[data-difficulty]").forEach((button) => button.addEventListener("click", () => { if (!game.started) newGame(button.dataset.difficulty); }));
  document.querySelectorAll("[data-prestart-difficulty]").forEach((button) => button.addEventListener("click", () => newGame(button.dataset.prestartDifficulty)));
  document.querySelectorAll("[data-use-card]").forEach((button) => button.addEventListener("click", () => useCard(button.dataset.useCard)));
  document.querySelectorAll("[data-equip-card]").forEach((button) => button.addEventListener("click", () => toggleEquipCard(button.dataset.equipCard)));
  document.querySelectorAll("[data-claim-card]").forEach((button) => button.addEventListener("click", () => claimCard(button.dataset.claimCard)));
  document.querySelector("#notes")?.addEventListener("click", () => { noteMode = !noteMode; render(); });
  document.querySelector("#alin-mode")?.addEventListener("click", () => { if (!game.started) { alinMode = !alinMode; render(); } });
  document.querySelector("#prestart-alin-mode")?.addEventListener("click", () => { if (!game.started) { alinMode = !alinMode; render(); } });
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
  document.querySelector("#toggle-sound")?.addEventListener("click", toggleSound);
  document.querySelector("#open-start-leaderboard")?.addEventListener("click", openLeaderboardModal);
  document.querySelector("#open-start-achievements")?.addEventListener("click", openAchievements);
  document.querySelector("#open-achievements-side")?.addEventListener("click", openAchievements);
  document.querySelector("#close-achievements")?.addEventListener("click", () => { showAchievements = false; render(); });
  document.querySelector("#close-leaderboard")?.addEventListener("click", () => { showLeaderboard = false; render(); });
  document.querySelectorAll("[data-rank-difficulty]").forEach((button) => button.addEventListener("click", () => changeLeaderboardDifficulty(button.dataset.rankDifficulty)));
  document.querySelector("#save-leaderboard-taunt")?.addEventListener("click", saveLeaderboardTaunt);
  document.querySelector("#open-save-center")?.addEventListener("click", openSaveCenter);
  document.querySelector("#close-save-center")?.addEventListener("click", () => { showSaveCenter = false; render(); });
  document.querySelector("#sync-cloud-now")?.addEventListener("click", () => syncCloudNow(true));
  document.querySelector("#rename-cloud-player")?.addEventListener("click", renamePlayer);
  document.querySelector("#switch-cloud-player")?.addEventListener("click", () => { showSaveCenter = false; showNameSetup = true; nameSetupStatus = ""; render(); });
  document.querySelector("#family-pin")?.addEventListener("input", (event) => {
    event.currentTarget.value = normalizePinInput(event.currentTarget.value);
  });
  document.querySelector("#create-player")?.addEventListener("click", createPlayer);
  document.querySelector("#load-cloud-player")?.addEventListener("click", loadExistingPlayer);
  document.querySelector("#close-backpack")?.addEventListener("click", () => { showBackpack = false; game.equippedCards = [...equippedCards]; render(); });
  document.querySelector("#open-avatar-picker")?.addEventListener("click", () => { showAvatarPicker = true; render(); });
  document.querySelector("#close-avatar-picker")?.addEventListener("click", () => { showAvatarPicker = false; render(); });
  document.querySelectorAll("[data-pick-animal]").forEach((button) => button.addEventListener("click", () => {
    progress = { ...progress, playerAvatar: button.dataset.pickAnimal, avatarColor: progress.avatarColor };
    saveProgress(progress);
    syncLeaderboardAvatar();
    render();
  }));
  document.querySelectorAll("[data-pick-color]").forEach((button) => button.addEventListener("click", () => {
    progress = { ...progress, avatarColor: Number(button.dataset.pickColor) };
    saveProgress(progress);
    syncLeaderboardAvatar();
    render();
  }));
}

function openSaveCenter() {
  cloudSyncStatus = cloudConfigured() ? "可手動立即同步，遊戲中也會定期自動同步。" : "請先完成 Supabase 設定。";
  showSaveCenter = true;
  render();
}

function openAchievements() {
  showAchievements = true;
  render();
}

function playerSetupValues() {
  const playerName = normalizePlayerName(document.querySelector("#player-name")?.value || "");
  const pin = normalizePinInput(document.querySelector("#family-pin")?.value || "");
  if (!playerName) throw new Error("請輸入玩家名稱");
  if (!validCloudPin(pin)) throw new Error("家庭 PIN 必須是 4 位數字");
  return { playerName, pin };
}

async function renamePlayer() {
  const pin = loadCloudPin();
  const playerName = normalizePlayerName(document.querySelector("#rename-player-name")?.value || "");
  if (!playerName) {
    cloudSyncStatus = "請輸入新的玩家名稱";
    render();
    return;
  }
  if (playerName === progress.playerName) {
    cloudSyncStatus = "新名稱和目前名稱相同";
    render();
    return;
  }
  cloudSyncStatus = "正在更新雲端玩家名稱…";
  render();
  try {
    await renameCloudPlayer({ playerId: progress.playerId, pin, playerName });
    progress = { ...progress, playerName };
    saveProgress(progress);
    await saveCloudProgress({ playerId: progress.playerId, playerName, pin, saveCode: exportSaveCode(progress, sessionSnapshot()) });
    cloudSyncStatus = `改名完成・現在是 ${playerName}`;
    render();
    showCelebration("✏️", "玩家名稱更新完成！", "雲端存檔與排行榜已同步");
  } catch (error) {
    cloudSyncStatus = error.message || "暫時無法修改名稱";
    if (showSaveCenter) render();
  }
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
  leaderboardDifficulty = alinMode ? "alin" : game.difficulty;
  leaderboardRows = [];
  leaderboardStatus = leaderboardConfigured() ? "正在讀取全球排行…" : "";
  leaderboardTauntStatus = "";
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
  leaderboardTauntStatus = "";
  render();
  refreshLeaderboard();
}

async function saveLeaderboardTaunt() {
  const pin = loadCloudPin();
  if (!validCloudPin(pin)) {
    leaderboardTauntStatus = "請先到存檔中心設定 4 位家庭 PIN";
    render();
    return;
  }
  const taunt = normalizeLeaderboardTaunt(document.querySelector("#leaderboard-taunt")?.value || "");
  leaderboardTauntStatus = "正在送出嗆聲…";
  render();
  try {
    await updateLeaderboardTaunt({ playerId: progress.playerId, pin, taunt });
    leaderboardTauntStatus = taunt ? "嗆聲已送上排行榜！" : "已清除嗆聲";
    await refreshLeaderboard();
  } catch (error) {
    leaderboardTauntStatus = error.message || "嗆聲暫時無法送出";
    if (showLeaderboard) render();
  }
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
    else showGameEffect("friends", game.failed ? "體力用完，雙雙昏倒！" : "猜錯了，雙雙昏倒！", alinMode ? "躺一下再繼續，阿霖模式不會失敗" : game.failed ? "休息一下，可以使用寶物或金幣復活" : "好朋友們休息一下，再陪你試一次！", "mistake", game.failed ? "failure" : "");
    document.body.classList.add("shake");
    setTimeout(() => document.body.classList.remove("shake"), 320);
    triggerAvatarAnim("shake");
    if (game.failed) {
      setAvatarFace("shocked", 3000);
    } else {
      setAvatarFace("sad", 2000);
    }
  } else {
    game.actions += 1;
    game.correctStreak += 1;
    game.values[index] = number;
    game.notes[index] = [];
    removeRelatedNotes(index, number);
    playSound("correct");
    const newlyCompleted = checkHealGoals();
    checkCompletion();
    render();
    if (!game.completed && !newlyCompleted.rows.length && !newlyCompleted.columns.length && !newlyCompleted.boxes.length) showGardenEel();
    return;
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
  showGameEffect("friends", "扭腰擺臀慶祝！", `${label}・${reward}`, "success");
  setAvatarFace("excited", 2500);
  triggerAvatarAnim("jump");
}

function celebrateCompletedUnit(type, unitIndex) {
  const goal = type === "row" ? "row" : type === "box" ? "box" : null;
  const label = type === "row" ? `第 ${unitIndex + 1} 行` : type === "column" ? `第 ${unitIndex + 1} 直列` : `第 ${unitIndex + 1} 宮`;
  const firstReward = goal && !game.healGoals[goal];
  const danceNames = {
    row: ["好朋友側滑、拍手跳", "好朋友扭腰、小碎步"],
    column: ["好朋友向上跳、伸懶腰", "好朋友蹲跳、衝天舞"],
    box: ["好朋友反方向繞圈", "好朋友抖肩、旋轉舞"]
  };
  const variant = queueCellWave(type, unitIndex);
  let detail = `${label}完成・${danceNames[type][variant]}！`;
  if (firstReward) {
    game.healGoals[goal] = true;
    const reward = healOrShield();
    detail = `${detail}・${reward}`;
    showCelebration("🎉", `首次完成${type === "row" ? "一行" : "一宮"}！`, reward);
  }
  showGameEffect("friends", `${label}完成，換舞步！`, detail, "success", `${type}-${variant}`);
  triggerAvatarAnim("jump");
  const totalCompleted = game.completedUnits.rows.length + game.completedUnits.columns.length + game.completedUnits.boxes.length;
  if (totalCompleted >= 18) setAvatarFace("excited", 3000);
  else if (totalCompleted >= 10) setAvatarFace("proud", 2500);
  else if (firstReward) setAvatarFace("love", 2500);
  else setAvatarFace("happy", 2000);
}

function checkHealGoals() {
  if (!game.healGoals.streak && game.correctStreak >= 8) completeHealGoal("streak", "連對 8 格");
  if (!game.completedUnits) game.completedUnits = { rows: [], columns: [], boxes: [] };
  else if (!Array.isArray(game.completedUnits.columns)) game.completedUnits.columns = completedSudokuUnits(game.values).columns;
  const newlyCompleted = newlyCompletedSudokuUnits(game.values, game.completedUnits);
  newlyCompleted.rows.forEach((row) => {
    game.completedUnits.rows.push(row);
    celebrateCompletedUnit("row", row);
  });
  newlyCompleted.columns.forEach((column) => {
    game.completedUnits.columns.push(column);
    celebrateCompletedUnit("column", column);
  });
  newlyCompleted.boxes.forEach((box) => {
    game.completedUnits.boxes.push(box);
    celebrateCompletedUnit("box", box);
  });
  checkRunMilestones();
  return newlyCompleted;
}

function checkRunMilestones() {
  game.milestones ||= [];
  RUN_MILESTONES.forEach((milestone) => {
    if (game.milestones.includes(milestone.id) || !milestone.test(game)) return;
    game.milestones.push(milestone.id);
    progress = { ...progress, coins: progress.coins + 2 };
    saveProgress(progress);
    showCelebration(milestone.icon, `本局里程碑・${milestone.name}`, `${milestone.detail}・🪙 +2`);
    showGameEffect("friends", `${milestone.name}達成！`, `${milestone.detail}，獲得 2 金幣`, "success");
    setAvatarFace("excited", 2500);
    triggerAvatarAnim("jump");
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
  setAvatarFace("thinking", 1500);
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
  if (source) showGameEffect(source.icon, `${source.name}發動，重新站起來！`, source.description, "card", "revive");
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
  showFinaleCelebration();
  const reward = DIFFICULTIES[game.difficulty];
  game.stars = calculateStars(game);
  const farmMultiplier = game.floor > 1 ? 0.55 : 1;
  game.xpReward = Math.max(10, Math.round(reward.xp * game.xpMultiplier * farmMultiplier));
  game.timeBonus = game.elapsed <= reward.bonusTime ? reward.bonusCoins : 0;
  game.remainingClaims = treasureClaimsForFloor(game.floor, game.extraCardClaims);
  game.cardChoices = game.remainingClaims ? drawTreasureCards(game.difficulty, game.stars, Math.max(3, game.remainingClaims)) : [];
  progress = rewardProgress(progress, game.xpReward, game.timeBonus, game.stars, game.difficulty);
  const achievementResult = recordAchievementGame(progress, {
    perfect: game.mistakes === 0 && game.hintsUsed === 0,
    speed: game.timeBonus > 0,
    alin: alinMode
  });
  progress = achievementResult.progress;
  saveProgress(progress);
  achievementResult.unlocked.forEach((achievement, index) => {
    setTimeout(() => showCelebration(achievement.icon, `永久成就・${achievement.name}`, `${achievement.description}・🪙 +${achievement.coins}`), 3500 + index * 450);
  });
  clearSession();
  queueLeaderboardScore(buildScore(progress, game, alinMode)).catch(() => {});
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
  if (!progress.playerAvatar) {
    showAvatarPicker = true;
    render();
    return;
  }
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
  if (!progress.playerAvatar) showAvatarPicker = true;
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
