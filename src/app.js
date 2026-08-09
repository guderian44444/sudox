import { DIFFICULTIES, relatedCells } from "./game/sudoku.js";
import { activateAutomaticTreasures, ADVENTURE_RULES, applyHintTreasure, applyImmediateTreasure, strongestEquippedRevive, sudokuUnitCells, TREASURE_AUTO_EFFECTS, TREASURE_CARDS } from "./game/adventure.js";
import {
  applyHintFill,
  applyPlayerDigit,
  claimRewardCard,
  clearEditableCell,
  collectBoardProgressEvents,
  collectNewMilestones,
  createAdventureGame,
  removeRelatedNotes,
  RUN_MILESTONES,
  settleCompletedGame
} from "./game/flow.js";
import { ACHIEVEMENTS, achievementValue, recordAchievementGame } from "./game/achievements.js";
import { chooseFriendPair, chooseGardenEel, choosePartyFriends, FRIEND_ROSTER, nextDanceVariants } from "./game/friends.js";
import { ISLAND_TEST_MODE } from "./island/catalog.js";
import { availableConstructionWorkerIds, availableHelperIds, collectFacility, createIslandState, finishIslandWork, hireConstructionHelper, marketSale, normalizeIslandState, selectSourceRecipe, settleIsland, startBuilding, startProcessing, startReclamation } from "./island/model.js";
import { formatIslandDuration, renderIslandScreen } from "./island/renderer.js";
import { cloudConfigured, loadCloudPin, loadCloudProgress, normalizePlayerName, renameCloudPlayer, saveCloudPin, saveCloudProgress, validCloudPin } from "./state/cloud.js";
import { buildScore, fetchLeaderboard, flushPendingScores, leaderboardConfigured, normalizeLeaderboardTaunt, pendingScoreCount, queueLeaderboardScore, updateLeaderboardAvatar, updateLeaderboardTaunt } from "./state/leaderboard.js";
import { addCard, clearSession, consumeCard, exportSaveCode, importSaveCode, loadProgress, loadSession, mergeProgressHighWater, nextFloorFromCompleted, parseSaveCode, preferSaveSide, raiseFloorProgress, rewardProgress, saveProgress, saveSession, saveTimestampMs, sessionFloorBehindProgress, spendCoins } from "./state/store.js";

const app = document.querySelector("#app");
const APP_VERSION = "v44";
const APP_LAST_UPDATED = "2026-08-09T13:50:00+08:00";
let progress = loadProgress();
const migratedAchievements = recordAchievementGame(progress);
progress = migratedAchievements.progress;
if (migratedAchievements.unlocked.length) saveProgress(progress);
const restoredSession = loadSession();
let game = restoredSession?.game || createAdventureGame({ difficulty: "easy", floor: 1 });
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
let leaderboardSyncStatus = "";
let nameSetupStatus = "";
let cloudSyncStatus = "";
let cloudSyncTimer;
let cloudHydrationPending = cloudConfigured() && Boolean(progress.playerName) && validCloudPin(loadCloudPin());
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
let danceVariantCursor = 0;
/** Three random stickers perched on the board frame (refreshed each new game). */
let boardBuddyIds = [];
let activeScreen = location.hash === "#island" ? "island" : "game";
let island = null;
let islandSelectedKey = "0,1";
let islandSelectedWorkerId = "";
let islandZoom = innerWidth > 900
  ? Math.max(0.62, Math.min(0.98, (innerHeight - 240) / 504))
  : 0.78;
let islandMapPosition = null;
let islandStatus = "";
let islandClockId;

const friendAssetUrl = (folder, fileName) => new URL(`../public/assets/${folder}/${fileName}`, import.meta.url).href;
const friendStickerUrl = (id) => friendAssetUrl("friends", `${id}.png`);
const friendDanceUrl = (id, variant) => friendAssetUrl("friends-dance", `${id}_${variant}.webp`);
const friendFaintUrl = (id) => friendAssetUrl("friends-faint", `${id}.webp`);

const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "時間未知";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei"
  }).format(date).replace(/\//g, "/");
};
const formatLeaderboardUpdatedAt = (value) => value ? formatDateTime(value) : "時間未知";
const LEADERBOARD_MODES = Object.freeze({
  easy: { icon: DIFFICULTIES.easy.icon, label: DIFFICULTIES.easy.label },
  medium: { icon: DIFFICULTIES.medium.icon, label: DIFFICULTIES.medium.label },
  hard: { icon: DIFFICULTIES.hard.icon, label: DIFFICULTIES.hard.label },
  alin: { icon: "🌈", label: "阿霖" }
});
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
  { id: "horse", emoji: "🐴", name: "馬" },
  { id: "deer", emoji: "🦌", name: "鹿" },
  { id: "sheep", emoji: "🐑", name: "羊" },
  { id: "otter", emoji: "🦦", name: "水獺" }
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

function pickBoardBuddies(count = 3, random = Math.random) {
  const pool = [...AVATAR_ANIMALS];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.max(0, Math.min(0.999999, Number(random()) || 0)) * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, Math.min(count, pool.length)).map((animal) => animal.id);
}

function refreshBoardBuddies() {
  boardBuddyIds = pickBoardBuddies(3);
}

function boardBuddiesMarkup() {
  if (!boardBuddyIds.length) refreshBoardBuddies();
  return `<div class="board-buddies" aria-hidden="true">${boardBuddyIds.map((id, index) => {
    const animal = AVATAR_ANIMALS.find((entry) => entry.id === id);
    const name = animal?.name || id;
    return `<span class="board-buddy buddy-${index + 1}" title="${escapeHtml(name)}">
      <img class="board-buddy-img" src="${friendStickerUrl(id)}" alt="" draggable="false" width="48" height="48">
    </span>`;
  }).join("")}</div>`;
}

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

function avatarStickerMarkup(animalId, name = "") {
  if (!animalId) return `<span class="avatar-placeholder-mark">❔</span>`;
  const label = name || AVATAR_ANIMALS.find((a) => a.id === animalId)?.name || animalId;
  return `<img class="avatar-sticker" src="${friendStickerUrl(animalId)}" alt="${escapeHtml(label)}" draggable="false" width="64" height="64">`;
}

function avatarMarkup(rank, row) {
  const hasLeaderboardRow = Boolean(row);
  const avatar = hasLeaderboardRow ? row.player_avatar : progress.playerAvatar;
  const color = hasLeaderboardRow ? (row.avatar_color != null ? row.avatar_color : 0) : (progress.avatarColor || 0);
  const wrapGameAvatar = (markup) => hasLeaderboardRow ? markup : `<div class="game-avatar-anchor">${markup}</div>`;
  if (!avatar) {
    const crown = rank === 0 ? "👑" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : "";
    return wrapGameAvatar(`<div class="player-avatar leaderboard-placeholder" aria-label="尚未選擇頭像"><span>${crown ? `<b>${crown}</b>` : ""}<small class="avatar-placeholder-mark">❔</small></span></div>`);
  }
  const animal = AVATAR_ANIMALS.find(a => a.id === avatar);
  const colorDef = AVATAR_COLORS[color] || AVATAR_COLORS[0];
  const face = getAvatarFace();
  const crown = rank === 0 ? "👑" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : "";
  return wrapGameAvatar(`<div class="player-avatar" style="--avatar-hue:${colorDef.hue}" data-animal="${avatar}"><span class="avatar-face-wrap">${crown ? `<b class="avatar-crown">${crown}</b>` : ""}${avatarStickerMarkup(avatar, animal?.name)}</span><em class="avatar-bubble">${face}</em></div>`);
}

/**
 * Event pair: two animals + rotating dance WebPs (variants 1–4).
 * Mistake mode uses dedicated faint animations (one per animal).
 */
function animatedFriendsMarkup(mode = "dance") {
  const selection = chooseFriendPair(lastFriendPairKey);
  lastFriendPairKey = selection.key;
  const variants = nextDanceVariants(danceVariantCursor);
  danceVariantCursor = variants.nextCursor;
  const [left, right] = selection.friends;
  const slots = [
    { friend: left, variant: variants.left },
    { friend: right, variant: variants.right }
  ];
  const animal = ({ friend, variant }, index) => {
    const src = mode === "faint"
      ? friendFaintUrl(friend.id)
      : friendDanceUrl(friend.id, variant);
    // Cache-bust restarts animated WebP frames each toast.
    const bust = `${src}?t=${Date.now() + index}`;
    return `<span class="animated-animal sticker-animal ${mode === "faint" ? "is-faint" : "is-dance"} ${friend.id}" title="${escapeHtml(friend.name)}" data-variant="${variant}">
      <img class="friend-sticker-img" src="${bust}" alt="" draggable="false" width="96" height="96" style="animation-delay:${index * 0.08}s">
    </span>`;
  };
  return `<span class="animated-friends sticker-friends mode-${mode}">${slots.map(animal).join("")}</span>`;
}

/** Full clear: player + 5 guests, each with a dance GIF. */
function partyFriendsMarkup() {
  const party = choosePartyFriends(progress.playerAvatar, 5);
  return `<span class="animated-friends party-friends">${party.map((friend, index) => {
    const variant = ((danceVariantCursor + index) % 4) + 1;
    return `<span class="animated-animal sticker-animal party-guest ${friend.id}${friend.id === progress.playerAvatar ? " is-player" : ""}" title="${escapeHtml(friend.name)}">
      <img class="friend-sticker-img" src="${friendDanceUrl(friend.id, variant)}" alt="" draggable="false" width="88" height="88" style="animation-delay:${index * 0.07}s">
    </span>`;
  }).join("")}</span>`;
}

function showGardenEel() {
  const board = document.querySelector(".sudoku-board");
  if (!board || !game.started || game.completed || game.failed) return;
  // Only blank cells — never cover a filled number.
  const emptyCells = game.values
    .map((value, index) => (value === 0 ? index : -1))
    .filter((index) => index >= 0);
  const pick = chooseGardenEel(Math.random, { emptyCells });
  if (!pick) return;
  const { cell, variant } = pick;
  const eel = document.createElement("span");
  eel.className = `garden-eel-peek ${variant}`;
  eel.style.left = `${((cell % 9) / 9) * 100}%`;
  eel.style.top = `${(Math.floor(cell / 9) / 9) * 100}%`;
  eel.setAttribute("title", variant === "orange" ? "橘色花園鰻偷看一下" : "白色花園鰻偷看一下");
  // Animated WebP has peek motion + real alpha (no checkerboard). Cache-bust restarts frames.
  const eelSrc = new URL(variant === "orange" ? "../public/assets/eel-orange.webp" : "../public/assets/eel-white.webp", import.meta.url).href;
  const img = document.createElement("img");
  img.className = "garden-eel-img";
  img.src = `${eelSrc}?t=${Date.now()}`;
  img.alt = "";
  img.setAttribute("aria-hidden", "true");
  img.draggable = false;
  eel.append(img);
  board.append(eel);
  // Match short peek clip (~2.4s) plus brief fade.
  setTimeout(() => eel.remove(), 2500);
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
  const friendsMarkup = hasFriends
    ? animatedFriendsMarkup(tone === "mistake" ? "faint" : "dance")
    : icon;
  effect.innerHTML = `
    <span class="effect-spark one">✦</span><span class="effect-spark two">●</span><span class="effect-spark three">✦</span>
    <div class="effect-character" aria-hidden="true">${friendsMarkup}</div>
    <div class="effect-bubble"><strong>${title}</strong><small>${detail}</small></div>
    <span class="effect-spark four">●</span><span class="effect-spark five">✦</span>`;
  document.body.append(effect);
  playSound(motion || tone);
  document.body.classList.remove("flash-success", "flash-mistake", "flash-shield", "flash-card");
  document.body.classList.add(`flash-${tone}`);
  setTimeout(() => document.body.classList.remove(`flash-${tone}`), 780);
  // Faint WebPs run ~2.7s; dances are shorter loops — keep toast long enough to read.
  const holdMs = tone === "mistake" ? 2800 : 1750;
  setTimeout(() => {
    effect.remove();
    gameEffectActive = false;
    playNextGameEffect();
  }, holdMs);
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
  const colors = ["#f47f62", "#ffd15c", "#56c9a5", "#69aee8", "#b78ade", "#ff9cc2", "#ff8f6b", "#7ee0c3"];
  const confetti = Array.from({ length: 64 }, (_, index) => {
    const left = (index * 37) % 100;
    const delay = (index % 12) * 0.07;
    const duration = 1.55 + (index % 7) * 0.13;
    const color = colors[index % colors.length];
    const shape = index % 3 === 0 ? "circle" : index % 3 === 1 ? "strip" : "diamond";
    return `<i class="confetti-${shape}" style="--confetti-left:${left}%;--confetti-delay:${delay}s;--confetti-duration:${duration}s;--confetti-color:${color};--confetti-rotation:${(index * 47) % 180}deg"></i>`;
  }).join("");
  const fireworks = Array.from({ length: 8 }, (_, index) => {
    const left = 8 + (index * 12) % 84;
    const top = 8 + (index * 17) % 48;
    const delay = (index % 5) * 0.22;
    const color = colors[index % colors.length];
    return `<span class="finale-firework" style="--fw-left:${left}%;--fw-top:${top}%;--fw-delay:${delay}s;--fw-color:${color}"></span>`;
  }).join("");
  const numbers = game.values.map((value, index) => `<span style="--finale-direction:${index % 2 ? 1 : -1}">${value}</span>`).join("");
  finale.innerHTML = `
    <div class="finale-glow"></div>
    <div class="finale-fireworks" aria-hidden="true">${fireworks}</div>
    <div class="finale-confetti" aria-hidden="true">${confetti}</div>
    <div class="finale-stage finale-party">
      <div class="finale-friends party-line" aria-hidden="true">${partyFriendsMarkup()}</div>
      <strong>全盤完成！好朋友大合舞！</strong>
      <div class="finale-board" aria-hidden="true">${numbers}</div>
      <small>阿霖的數獨島・完美過關・灑花放煙火</small>
    </div>`;
  document.body.append(finale);
  playFinaleMelody();
  setTimeout(() => finale.classList.add("leaving"), 4200);
  setTimeout(() => finale.remove(), 4800);
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

function islandOwner(now = Date.now()) {
  return {
    playerId: progress.playerId,
    playerName: progress.playerName,
    playerAvatar: progress.playerAvatar || "cat",
    now
  };
}

function ensureIsland() {
  const now = Date.now();
  if (!progress.island) {
    island = createIslandState(islandOwner(now));
    progress = { ...progress, coins: progress.coins + 100, island };
    saveProgress(progress);
    scheduleCloudSync();
    islandStatus = "島主開發金 🪙 100 已入帳，先填海或從空地開始建設吧！";
    return island;
  }
  island = normalizeIslandState(progress.island, islandOwner(now));
  return island;
}

function commitIsland(nextIsland, { coinDelta = 0, status = "", rerender = true } = {}) {
  island = nextIsland;
  progress = {
    ...progress,
    coins: Math.max(0, progress.coins + coinDelta),
    island: nextIsland
  };
  saveProgress(progress);
  scheduleCloudSync();
  islandStatus = status;
  if (rerender) renderIslandView();
}

function settleIslandNow(now = Date.now()) {
  if (!island) return false;
  const result = settleIsland(island, now);
  if (!result.changed) return false;
  const completedNames = result.completed.map((entry) => entry.name).filter(Boolean);
  commitIsland(result.state, {
    status: completedNames.length ? `完成：${completedNames.join("、")}` : "小島進度已依真實時間更新。",
    rerender: false
  });
  return true;
}

function islandHelpers() {
  const ids = availableHelperIds(island, FRIEND_ROSTER.map((friend) => friend.id), progress.playerAvatar || "cat");
  return ids.map((id) => FRIEND_ROSTER.find((friend) => friend.id === id)).filter(Boolean);
}

function islandWorkers() {
  const ids = availableConstructionWorkerIds(island, FRIEND_ROSTER.map((friend) => friend.id));
  const ownId = progress.playerAvatar || "cat";
  return ids.map((id) => FRIEND_ROSTER.find((friend) => friend.id === id)).filter(Boolean)
    .sort((left, right) => Number(right.id === ownId) - Number(left.id === ownId));
}

function ensureIslandSelectedWorker() {
  const workers = islandWorkers();
  if (!workers.some((worker) => worker.id === islandSelectedWorkerId)) {
    islandSelectedWorkerId = workers[0]?.id || "";
  }
  return workers;
}

function renderIslandView() {
  if (!island) ensureIsland();
  if (!islandClockId) islandClockId = setInterval(refreshIslandClock, 1000);
  settleIslandNow();
  const workers = ensureIslandSelectedWorker();
  app.innerHTML = renderIslandScreen({
    state: island,
    coins: progress.coins,
    selectedKey: islandSelectedKey,
    zoom: islandZoom,
    status: islandStatus,
    helpers: islandHelpers(),
    workers,
    selectedWorkerId: islandSelectedWorkerId,
    playerAvatar: progress.playerAvatar || "cat",
    testMode: ISLAND_TEST_MODE,
    version: APP_VERSION
  });
  const mapViewport = document.querySelector("[data-island-map-viewport]");
  if (mapViewport) {
    const target = islandMapPosition || {
      left: Math.max(0, (mapViewport.scrollWidth - mapViewport.clientWidth) / 2),
      top: Math.max(0, (mapViewport.scrollHeight - mapViewport.clientHeight) / 2)
    };
    mapViewport.scrollLeft = target.left;
    mapViewport.scrollTop = target.top;
    islandMapPosition = { left: mapViewport.scrollLeft, top: mapViewport.scrollTop };
  }
  bindIslandEvents();
  refreshIslandClock();
}

function openIsland() {
  persistSession();
  activeScreen = "island";
  history.replaceState(null, "", `${location.pathname}${location.search}#island`);
  ensureIsland();
  clearInterval(islandClockId);
  islandClockId = setInterval(refreshIslandClock, 1000);
  renderIslandView();
}

function closeIsland() {
  clearInterval(islandClockId);
  islandClockId = undefined;
  activeScreen = "game";
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  render();
}

function refreshIslandClock() {
  if (activeScreen !== "island" || !island) return;
  const now = Date.now();
  let reachedReadyAt = false;
  document.querySelectorAll("[data-island-ready-at]").forEach((element) => {
    const readyAt = Number(element.dataset.islandReadyAt) || 0;
    element.textContent = formatIslandDuration((readyAt - now) / 1000);
    if (readyAt <= now) reachedReadyAt = true;
  });
  if (reachedReadyAt && settleIslandNow(now)) renderIslandView();
}

function affordIslandResult(result, successStatus) {
  if (!result.ok) {
    islandStatus = result.error || "目前無法執行這項操作。";
    renderIslandView();
    return;
  }
  if (!ISLAND_TEST_MODE && progress.coins < result.costCoins) {
    islandStatus = `金幣不足，還需要 🪙 ${result.costCoins - progress.coins}。`;
    renderIslandView();
    return;
  }
  commitIsland(result.state, { coinDelta: ISLAND_TEST_MODE ? 0 : -result.costCoins, status: successStatus });
}

function changeIslandZoom(direction) {
  const delta = direction === "in" ? 0.06 : -0.06;
  islandZoom = Math.max(0.55, Math.min(1.25, islandZoom + delta));
  renderIslandView();
}

function bindIslandMapDrag(viewport) {
  if (!viewport) return;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let dragged = false;

  viewport.addEventListener("scroll", () => {
    islandMapPosition = { left: viewport.scrollLeft, top: viewport.scrollTop };
  }, { passive: true });
  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest(".island-map-zoom")) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startLeft = viewport.scrollLeft;
    startTop = viewport.scrollTop;
    dragged = false;
  });
  viewport.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    if (!dragged && Math.hypot(deltaX, deltaY) < 6) return;
    if (!dragged) {
      dragged = true;
      viewport.setPointerCapture?.(pointerId);
    }
    viewport.classList.add("is-dragging");
    viewport.scrollLeft = startLeft - deltaX;
    viewport.scrollTop = startTop - deltaY;
    event.preventDefault();
  });
  const finishDrag = (event) => {
    if (event.pointerId !== pointerId) return;
    if (dragged) {
      viewport.dataset.islandDragged = "true";
      setTimeout(() => { delete viewport.dataset.islandDragged; }, 0);
    }
    viewport.classList.remove("is-dragging");
    if (viewport.hasPointerCapture?.(pointerId)) viewport.releasePointerCapture(pointerId);
    pointerId = null;
  };
  viewport.addEventListener("pointerup", finishDrag);
  viewport.addEventListener("pointercancel", finishDrag);
}

function bindIslandEvents() {
  document.querySelector("#close-island")?.addEventListener("click", closeIsland);
  document.querySelectorAll("[data-island-cell]").forEach((button) => button.addEventListener("click", () => {
    if (button.closest("[data-island-map-viewport]")?.dataset.islandDragged === "true") return;
    islandSelectedKey = button.dataset.islandCell;
    islandStatus = "";
    renderIslandView();
  }));
  document.querySelectorAll("[data-island-zoom]").forEach((button) => button.addEventListener("click", () => {
    changeIslandZoom(button.dataset.islandZoom);
  }));
  const mapViewport = document.querySelector("[data-island-map-viewport]");
  bindIslandMapDrag(mapViewport);
  mapViewport?.addEventListener("wheel", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    changeIslandZoom(event.deltaY < 0 ? "in" : "out");
  }, { passive: false });
  document.querySelectorAll("[data-island-worker]").forEach((button) => button.addEventListener("click", () => {
    islandSelectedWorkerId = button.dataset.islandWorker;
    islandStatus = "";
    renderIslandView();
  }));
  document.querySelectorAll("[data-island-jump]").forEach((button) => button.addEventListener("click", () => {
    islandSelectedKey = button.dataset.islandJump;
    islandStatus = "";
    renderIslandView();
  }));
  document.querySelector("[data-island-reclaim]")?.addEventListener("click", () => {
    const [q, r] = islandSelectedKey.split(",").map(Number);
    affordIslandResult(startReclamation(island, { q, r, workerId: islandSelectedWorkerId, playerAvatar: progress.playerAvatar || "cat" }), "伙伴已開始填海造陸！");
  });
  document.querySelectorAll("[data-island-build]").forEach((button) => button.addEventListener("click", () => {
    const [q, r] = islandSelectedKey.split(",").map(Number);
    const buildingName = button.querySelector("strong")?.textContent || "設施";
    affordIslandResult(startBuilding(island, { buildingId: button.dataset.islandBuild, q, r, workerId: islandSelectedWorkerId, playerAvatar: progress.playerAvatar || "cat" }), `${buildingName} 已開始施工！`);
  }));
  document.querySelectorAll("[data-island-hire]").forEach((button) => button.addEventListener("click", () => {
    affordIslandResult(hireConstructionHelper(island, { jobId: button.dataset.islandHire, helperId: button.dataset.islandHelper }), "新伙伴加入，完工時間已提前！");
  }));
  document.querySelectorAll("[data-island-collect]").forEach((button) => button.addEventListener("click", () => {
    const result = collectFacility(island, { buildingInstanceId: button.dataset.islandCollect });
    if (!result.ok) {
      islandStatus = result.error;
      renderIslandView();
      return;
    }
    commitIsland(result.state, { status: "產品已領取到無上限倉庫。" });
  }));
  document.querySelectorAll("[data-island-source-recipe]").forEach((button) => button.addEventListener("click", () => {
    const result = selectSourceRecipe(island, { buildingInstanceId: button.dataset.islandBuilding, recipeId: button.dataset.islandSourceRecipe });
    if (!result.ok) {
      islandStatus = result.error;
      renderIslandView();
      return;
    }
    commitIsland(result.state, { status: `已改為「${result.recipe.name}」，本批時間重新計算。` });
  }));
  document.querySelectorAll("[data-island-process]").forEach((button) => button.addEventListener("click", () => {
    const result = startProcessing(island, { buildingInstanceId: button.dataset.islandBuilding, recipeId: button.dataset.islandProcess, ignoreInputs: ISLAND_TEST_MODE });
    if (!result.ok) {
      islandStatus = result.error;
      renderIslandView();
      return;
    }
    commitIsland(result.state, { status: "加工批次已啟動；同一座設施可以繼續接收其他批次。" });
  }));
  document.querySelectorAll("[data-island-sell]").forEach((button) => button.addEventListener("click", () => {
    const result = marketSale(island, { itemId: button.dataset.islandSell, quantity: Number(button.dataset.islandQuantity) });
    if (!result.ok) {
      islandStatus = result.error;
      renderIslandView();
      return;
    }
    commitIsland(result.state, { coinDelta: ISLAND_TEST_MODE ? 0 : result.coinsEarned, status: `市場售出完成，獲得 🪙 ${result.coinsEarned}。` });
  }));
  document.querySelectorAll("[data-island-finish-kind]").forEach((button) => button.addEventListener("click", () => {
    if (!ISLAND_TEST_MODE) return;
    const result = finishIslandWork(island, { kind: button.dataset.islandFinishKind, id: button.dataset.islandFinishId });
    if (!result.ok) {
      islandStatus = result.error;
      renderIslandView();
      return;
    }
    commitIsland(result.state, { status: "測試模式：工作已馬上完成。" });
  }));
}

function render() {
  if (activeScreen === "island" && !showNameSetup) {
    persistSession();
    ensureIsland();
    renderIslandView();
    return;
  }
  persistSession();
  const levelTarget = progress.level * 100;
  const selectedValue = game.values[game.selected];
  const related = relatedCells(game.selected);
  const inventoryTotal = Object.values(progress.inventory).reduce((total, count) => total + count, 0);
  app.innerHTML = `
    <main class="shell ${game.started ? "game-active" : ""}">
      <header class="topbar">
        <div class="brand">${mascot()}<div><span>阿霖的數獨島</span><small>ALIN'S SUDOKU ISLAND</small></div></div>
        <div class="topbar-actions"><div class="wallet" aria-label="玩家資源"><span>⭐ ${progress.totalStars}</span><span>🪙 ${progress.coins}</span></div><button id="open-island" class="save-button">🏝️ <span>小島</span></button><button id="toggle-sound" class="save-button sound-button" aria-label="${soundEnabled ? "關閉音效" : "開啟音效"}" aria-pressed="${soundEnabled}">${soundEnabled ? "🔊" : "🔇"}</button><button id="open-avatar-picker" class="save-button">🐾 <span>頭像</span></button><button id="open-leaderboard" class="save-button">🏆 <span>排行</span></button><button id="open-save-center" class="save-button">💾 <span>存檔</span></button></div>
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
          <button class="island-card" id="open-island-side"><span>🏝️</span><div><strong>建設我的小島</strong><small>${progress.island ? `${Object.keys(progress.island.tiles || {}).length} 格土地・點我進入` : "首次進入贈 100 開發金"}</small></div></button>
          <button class="island-card achievement-island-card" id="open-achievements-side"><span>🏅</span><div><strong>成就圖鑑</strong><small>${progress.achievements?.length || 0}/${ACHIEVEMENTS.length} 個・${progress.totalStars} 顆星</small></div></button>
        </aside>

        <section class="board-card" aria-label="數獨遊戲">
          ${boardBuddiesMarkup()}
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
            ${avatarMarkup()}
          </div>
          <div class="board-stage">
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
          </div>
          <div class="number-pad" aria-label="數字鍵盤">${Array.from({ length: 9 }, (_, index) => `<button data-number="${index + 1}">${index + 1}</button>`).join("")}</div>
          <div class="tools">
            <button id="undo" aria-label="清除目前格"><span>⌫</span><small>清除</small></button>
            <button id="notes" class="${noteMode ? "active" : ""}" aria-pressed="${noteMode}"><span>✎</span><small>筆記 ${noteMode ? "開" : "關"}</small></button>
            <button id="hint"><span>💡</span><small>${currentHintCost() ? `提示 -${currentHintCost()}` : "免費提示"}</small></button>
          </div>
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
      <footer class="app-footer" aria-label="版本資訊"><span>版次 ${APP_VERSION}</span><span>最後更新 ${formatDateTime(APP_LAST_UPDATED)}（台灣時間）</span></footer>
    </main>
    ${showNameSetup ? nameSetupModal() : showLeaderboard ? leaderboardModal() : showAchievements ? achievementModal() : showSaveCenter ? saveCenterModal() : showBackpack ? backpackModal() : showAvatarPicker ? avatarPickerModal() : !game.started ? startModal() : game.completed ? completionModal() : game.failed ? failureModal() : ""}
  `;
  bindEvents();
  syncLeaderboardStatusUi();
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
  const rememberedPin = validCloudPin(loadCloudPin()) ? loadCloudPin() : "";
  const defaultStatus = rememberedPin
    ? "本機已記住家庭 PIN，已自動填入；同一台裝置的舊玩家不必重設。"
    : cloudConfigured()
      ? "第一次玩請建立玩家；換裝置才需要輸入名稱與 PIN 載入雲端。"
      : "資料庫尚未設定，目前可先建立本機玩家。";
  return `<div class="modal-backdrop"><section class="modal name-modal" role="dialog" aria-modal="true" aria-labelledby="name-title">
    <div class="celebrate">🏝️</div><p class="eyebrow">WELCOME</p><h2 id="name-title">冒險家叫什麼名字？</h2>
    <p>名稱會顯示在家庭排行榜。4 位數家庭 PIN 用來在其他裝置找回雲端存檔；同一台裝置會記住，不必每次重輸。</p>
    <label class="field-label" for="player-name">玩家名稱</label>
    <input id="player-name" class="name-input" maxlength="16" autocomplete="nickname" value="${escapeHtml(progress.playerName || "")}" placeholder="例如：阿霖">
    <label class="field-label" for="family-pin">家庭 PIN${rememberedPin ? "（本機已記住）" : ""}</label>
    <input id="family-pin" class="name-input pin-input" type="text" maxlength="4" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" autocomplete="off" placeholder="4 位數字" value="${escapeHtml(rememberedPin)}">
    <p class="name-status" role="status">${escapeHtml(nameSetupStatus || defaultStatus)}</p>
    <div class="save-actions"><button id="create-player">✨ 建立新玩家</button><button id="load-cloud-player" ${cloudConfigured() ? "" : "disabled"}>☁️ 載入雲端進度</button></div>
  </section></div>`;
}

function leaderboardModal() {
  const configured = leaderboardConfigured();
  const myRow = leaderboardRows.find((row) => row.player_id === progress.playerId);
  const modeLabel = LEADERBOARD_MODES[leaderboardDifficulty]?.label || "此難度";
  const tauntHint = myRow
    ? `只套用在「${modeLabel}」榜・最多 48 字`
    : `先在「${modeLabel}」完成一局上榜後就能留言`;
  return `<div class="modal-backdrop"><section class="modal leaderboard-modal" role="dialog" aria-modal="true" aria-labelledby="leaderboard-title">
    <div class="celebrate">🏆</div><h2 id="leaderboard-title">家庭全球排行</h2>
    <div class="leaderboard-tabs">${Object.entries(LEADERBOARD_MODES).map(([key, item]) => `<button data-rank-difficulty="${key}" class="${leaderboardDifficulty === key ? "active" : ""}">${item.icon} ${item.label}</button>`).join("")}</div>
    ${!configured ? `<div class="empty-ranking"><strong>尚未連接資料庫</strong><small>設定 Supabase 後，家人的成績會出現在這裡。</small></div>` : leaderboardStatus ? `<div class="empty-ranking"><span class="loading-orbit">☁️</span><small>${escapeHtml(leaderboardStatus)}</small></div>` : leaderboardRows.length ? `<div class="leaderboard-list">${leaderboardRows.map((row, index) => `
      <div class="leaderboard-row ${row.player_id === progress.playerId ? "mine" : ""}"><b>${index + 1}</b>${avatarMarkup(index, row)}<span class="leaderboard-player"><strong>${escapeHtml(row.player_name)}</strong><small>${row.stars}⭐・${row.mistakes} 次失誤・${formatTime(row.elapsed_seconds)}</small>${row.taunt ? `<q>${escapeHtml(row.taunt)}</q>` : `<q class="quiet">還沒有留下嗆聲</q>`}</span><span class="leaderboard-result"><strong>第 ${row.floor} 層</strong><time datetime="${escapeHtml(row.updated_at || "")}">最後更新<br>${formatLeaderboardUpdatedAt(row.updated_at)}</time></span></div>`).join("")}</div>` : `<div class="empty-ranking"><strong>還沒有成績</strong><small>完成第一層就能成為榜首！</small></div>`}
    ${configured ? `<div class="taunt-editor"><label for="leaderboard-taunt">📣 ${escapeHtml(modeLabel)}・我的島主宣言</label><div><input id="leaderboard-taunt" maxlength="48" value="${escapeHtml(myRow?.taunt || "")}" placeholder="例如：這難度先借我坐一下！"><button id="save-leaderboard-taunt" ${myRow ? "" : "disabled"}>送出</button></div><small>${escapeHtml(leaderboardTauntStatus || tauntHint)}</small></div>` : ""}
    <p class="pending-scores">${pendingScoreCount() ? `尚有 ${pendingScoreCount()} 筆離線成績等待同步` : "每位玩家、每個難度只保留最佳成績；嗆聲也依難度分開"}</p>
    <button id="close-leaderboard" class="primary-button">回到遊戲</button>
  </section></div>`;
}

function saveCenterModal() {
  const configured = cloudConfigured();
  const pinReady = validCloudPin(loadCloudPin());
  const pinStatusTitle = !configured
    ? "等待設定 Supabase"
    : pinReady
      ? "雲端同步已就緒・本機已記住 PIN"
      : progress.playerName
        ? "輸入一次家庭 PIN 即可繼續同步"
        : "需要先建立玩家與家庭 PIN";
  const pinStatusDetail = cloudSyncStatus || (
    !configured
      ? "設定完成前仍會安全保存在這台裝置"
      : pinReady
        ? `玩家：${progress.playerName}・舊玩家不必重新設定 PIN`
        : progress.playerName
          ? "這台裝置還沒記住 PIN（可能清過瀏覽器資料）。輸入原本的 4 位數即可，不用重建角色。"
          : "建立玩家後會記住 PIN，之後同一台裝置都不用重輸"
  );
  return `<div class="modal-backdrop"><section class="modal save-modal" role="dialog" aria-modal="true" aria-labelledby="save-title">
    <div class="celebrate">☁️</div><h2 id="save-title">雲端存檔</h2>
    <p>本機會隨時自動保存；連上網路後，玩家資料、裝備、XP、層數和目前盤面也會同步到家庭雲端。已存在玩家的 PIN 不會因這次更新作廢。</p>
    <div class="cloud-card ${configured && pinReady ? "ready" : "waiting"}"><span>${configured && pinReady ? "✅" : "⚙️"}</span><div><strong>${pinStatusTitle}</strong><small>${escapeHtml(pinStatusDetail)}</small></div></div>
    ${configured && progress.playerName && !pinReady ? `<div class="pin-unlock"><label class="field-label" for="unlock-family-pin">家庭 PIN（輸入一次，本機會記住）</label><div><input id="unlock-family-pin" class="name-input pin-input" type="text" maxlength="4" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" autocomplete="off" placeholder="4 位數字"><button id="unlock-family-pin-btn">記住並啟用同步</button></div></div>` : ""}
    <div class="rename-player"><label for="rename-player-name">✏️ 修改玩家名稱</label><div><input id="rename-player-name" maxlength="16" value="${escapeHtml(progress.playerName || "")}" placeholder="新的玩家名稱"><button id="rename-cloud-player" ${configured && pinReady && progress.playerName ? "" : "disabled"}>改名</button></div><small>${pinReady ? "使用本機已記住的家庭 PIN 驗證，不必重輸。" : "啟用 PIN 後才能改名並同步雲端。"}</small></div>
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
    <p>選一個好朋友代表你，在遊戲中會陪你一起解數獨！</p>
    <div class="avatar-preview" style="filter: hue-rotate(${color.hue})">${animal ? avatarStickerMarkup(animal.id, animal.name) : `<span class="avatar-placeholder-mark big">❔</span>`}</div>
    <div class="avatar-picker-grid">${AVATAR_ANIMALS.map(a => `
      <button data-pick-animal="${a.id}" class="avatar-picker-animal ${selectedAnimal === a.id ? "selected" : ""}" title="${a.name}">
        <img class="avatar-picker-sticker" src="${friendStickerUrl(a.id)}" alt="${escapeHtml(a.name)}" draggable="false" width="48" height="48"><small>${a.name}</small>
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

function syncLeaderboardStatusUi() {
  const pending = document.querySelector(".leaderboard-modal .pending-scores");
  if (!pending) return;
  pending.parentElement.querySelectorAll("[data-leaderboard-sync]").forEach((element) => element.remove());
  const insertAfter = (element) => pending.parentElement.insertBefore(element, pending.nextSibling);
  if (leaderboardSyncStatus) {
    const status = document.createElement("p");
    status.dataset.leaderboardSync = "status";
    status.className = "leaderboard-sync-status";
    status.setAttribute("role", "status");
    status.textContent = leaderboardSyncStatus;
    insertAfter(status);
  }
  if (leaderboardConfigured() && pendingScoreCount()) {
    const retry = document.createElement("button");
    retry.dataset.leaderboardSync = "retry";
    retry.className = "secondary-button";
    retry.textContent = "立即重試排行榜同步";
    retry.addEventListener("click", retryLeaderboardSync);
    insertAfter(retry);
  }
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
  document.querySelector("#open-island")?.addEventListener("click", openIsland);
  document.querySelector("#open-island-side")?.addEventListener("click", openIsland);
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
  document.querySelector("#unlock-family-pin")?.addEventListener("input", (event) => {
    event.currentTarget.value = normalizePinInput(event.currentTarget.value);
  });
  document.querySelector("#unlock-family-pin-btn")?.addEventListener("click", unlockFamilyPin);
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

async function unlockFamilyPin() {
  const pin = normalizePinInput(document.querySelector("#unlock-family-pin")?.value || "");
  if (!validCloudPin(pin)) {
    cloudSyncStatus = "家庭 PIN 必須是 4 位數字";
    render();
    return;
  }
  if (!progress.playerName) {
    cloudSyncStatus = "請先建立或載入玩家";
    render();
    return;
  }
  cloudSyncStatus = "正在用原本的 PIN 啟用同步…";
  render();
  try {
    if (cloudConfigured() && navigator.onLine) {
      try {
        // Existing cloud account: verify name + PIN (do not apply cloud save here).
        await loadCloudProgress(progress.playerName, pin);
      } catch {
        // No cloud row yet, or this device is first-time online: create/update with local progress.
        await saveCloudProgress({
          playerId: progress.playerId,
          playerName: progress.playerName,
          pin,
          saveCode: exportSaveCode(progress, sessionSnapshot())
        });
      }
    }
    saveCloudPin(pin);
    cloudSyncStatus = "已記住家庭 PIN・舊玩家可直接同步，不必重建角色";
    showCelebration("🔐", "PIN 已記住", "這台裝置之後都不用重新輸入");
    scheduleCloudSync();
    flushPendingScores().catch(() => {});
    render();
  } catch (error) {
    // Wrong PIN / name taken: never wipe local progress.
    cloudSyncStatus = error.message || "PIN 不正確，本機進度仍保留";
    if (showSaveCenter) render();
  }
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

function applyImportedSave(imported, { mergeWithLocal = null } = {}) {
  progress = mergeWithLocal
    ? mergeProgressHighWater(imported.progress, mergeWithLocal)
    : imported.progress;
  island = null;
  if (imported.session) {
    game = imported.session.game;
    equippedCards = imported.session.equippedCards || [];
    alinMode = imported.session.alinMode || false;
    // Session may be mid-floor while floors counter lagged — keep next-floor high water.
    if (game?.difficulty && game?.floor) {
      progress = raiseFloorProgress(progress, game.difficulty, game.floor);
    }
  } else {
    equippedCards = [];
    const fallbackDifficulty = game?.difficulty && game.difficulty !== "alin" ? game.difficulty : "easy";
    game = createAdventureGame({
      difficulty: fallbackDifficulty,
      floor: progress.floors?.[fallbackDifficulty] || 1,
      equippedCards
    });
    lastWaveVariants = { row: null, column: null, box: null };
  }
}

/** Keep an active run aligned with the saved next-floor record across devices. */
function reconcileActiveSessionFloor() {
  if (!game?.difficulty || game.completed || game.failed) return false;

  if (!sessionFloorBehindProgress(progress, game)) {
    const raised = raiseFloorProgress(progress, game.difficulty, game.floor);
    if (raised !== progress) {
      progress = raised;
      saveProgress(progress, { touch: false });
    }
    return false;
  }

  const difficulty = game.difficulty;
  const floor = Math.max(1, Math.floor(Number(progress.floors?.[difficulty]) || 1));
  clearInterval(timerId);
  equippedCards = equippedCards.filter((cardId) => progress.inventory[cardId] > 0).slice(0, 2);
  game = createAdventureGame({ difficulty, floor, equippedCards });
  clearSession();
  lastWaveVariants = { row: null, column: null, box: null };
  return true;
}

/** Leaderboard floor = highest completed; local floors = next to play. */
function reconcileFloorsFromLeaderboardRows(rows) {
  if (!Array.isArray(rows) || !progress?.playerId) return false;
  let changed = false;
  let next = progress;
  rows.forEach((row) => {
    if (row.player_id !== progress.playerId) return;
    const difficulty = row.difficulty === "alin" ? (game?.difficulty || "easy") : row.difficulty;
    const raised = raiseFloorProgress(next, difficulty, nextFloorFromCompleted(row.floor));
    if (raised !== next) {
      next = raised;
      changed = true;
    }
  });
  if (changed) {
    progress = next;
    saveProgress(progress);
  }
  return changed;
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

async function hydrateCloudProgress() {
  if (!cloudHydrationPending) return;
  clearTimeout(cloudSyncTimer);
  const pin = loadCloudPin();
  try {
    const saveCode = await loadCloudProgress(progress.playerName, pin);
    // Parse only — never write localStorage until we know cloud is actually newer.
    const cloud = parseSaveCode(saveCode);
    const localHasSession = Boolean(sessionSnapshot() || loadSession());
    const winner = preferSaveSide(progress, cloud.progress, {
      cloudExportedAt: cloud.exportedAt,
      localHasSession,
      cloudHasSession: Boolean(cloud.session)
    });

    if (winner === "cloud") {
      const imported = importSaveCode(saveCode, { touch: false });
      clearInterval(timerId);
      // Cloud wins base fields, but never drop higher local floors / lifetime counters.
      applyImportedSave(imported, { mergeWithLocal: progress });
      saveProgress(progress, { touch: false });
      reconcileActiveSessionFloor();
      if (imported.session?.game) startTimer();
      cloudSyncStatus = "已載入雲端的較新進度";
      cloudHydrationPending = false;
      if (!progress.playerAvatar) showAvatarPicker = true;
      render();
      return;
    }

    // Local is newer or equivalent — still high-water floors from cloud so we don't lag behind another device.
    const mergedLocal = mergeProgressHighWater(progress, cloud.progress);
    const progressChanged = JSON.stringify(mergedLocal.floors) !== JSON.stringify(progress.floors)
      || mergedLocal.completedGames !== progress.completedGames;
    if (progressChanged) {
      progress = mergedLocal;
      saveProgress(progress);
    }
    cloudSyncStatus = localHasSession || saveTimestampMs(progress)
      ? "本機進度較新或相同，已保留本機並準備同步"
      : "已核對雲端進度，繼續使用本機存檔";
    cloudHydrationPending = false;
    const sessionReset = reconcileActiveSessionFloor();
    if (progressChanged || sessionReset) render();
    else scheduleCloudSync();
  } catch {
    // Keep the local save when cloud loading is unavailable; never overwrite a remote save blindly.
    cloudHydrationPending = false;
  }
}

function scheduleCloudSync() {
  if (cloudHydrationPending) return;
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
  applyLeaderboardSyncResult(await flushPendingScores());
  await refreshLeaderboard();
}

async function refreshLeaderboard() {
  if (!leaderboardConfigured()) return;
  try {
    leaderboardRows = await fetchLeaderboard(leaderboardDifficulty);
    leaderboardStatus = "";
    // If my uploaded completed floor is ahead of local next-floor, catch up.
    reconcileFloorsFromLeaderboardRows(leaderboardRows);
  } catch (error) {
    leaderboardRows = [];
    leaderboardStatus = error.message || "排行榜暫時無法連線";
  }
  if (showLeaderboard) render();
}

function applyLeaderboardSyncResult(result) {
  if (result?.error) {
    leaderboardSyncStatus = `排行榜同步失敗：${result.error}（尚有 ${result.pending} 筆待同步）`;
  } else if (result?.pending) {
    leaderboardSyncStatus = `已同步 ${result.sent} 筆，尚有 ${result.pending} 筆待同步`;
  } else if (result?.sent) {
    leaderboardSyncStatus = `排行榜已同步 ${result.sent} 筆`;
  } else {
    leaderboardSyncStatus = "";
  }
  leaderboardTauntStatus = leaderboardSyncStatus;
}

async function retryLeaderboardSync() {
  leaderboardSyncStatus = "正在重試排行榜同步…";
  leaderboardTauntStatus = leaderboardSyncStatus;
  render();
  try {
    applyLeaderboardSyncResult(await flushPendingScores());
    await refreshLeaderboard();
  } catch (error) {
    leaderboardSyncStatus = error.message || "排行榜同步失敗，請稍後重試";
    leaderboardTauntStatus = leaderboardSyncStatus;
    if (showLeaderboard) render();
  }
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
  const modeLabel = LEADERBOARD_MODES[leaderboardDifficulty]?.label || "此難度";
  leaderboardTauntStatus = `正在送出「${modeLabel}」嗆聲…`;
  render();
  try {
    await updateLeaderboardTaunt({
      playerId: progress.playerId,
      pin,
      taunt,
      difficulty: leaderboardDifficulty
    });
    leaderboardTauntStatus = taunt
      ? `「${modeLabel}」嗆聲已更新！`
      : `已清除「${modeLabel}」嗆聲`;
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

function presentBoardProgressEvents(events) {
  // Flavor lines — describe the moment, not the old CSS puppet moves.
  const cheerLines = {
    row: ["整排亮燈，好朋友來站台！", "一排數字排好了，蹦迪時間！"],
    column: ["從上到下串成彩虹橋！", "這一柱氣勢，誰看了不鼓掌？"],
    box: ["九宮格變成小派對帳篷！", "這一宮塞滿歡呼聲！"]
  };
  const healLines = ["好朋友們為你打氣！", "回復滿點，繼續衝啊！", "島上氣氛瞬間熱起來！"];
  events.forEach((event) => {
    if (event.kind === "healGoal") {
      showCelebration("🎉", `恭喜完成「${event.label}」！`, event.reward);
      showGameEffect("friends", healLines[Math.floor(Math.random() * healLines.length)], `${event.label}・${event.reward}`, "success");
      setAvatarFace("excited", 2500);
      triggerAvatarAnim("jump");
      return;
    }
    if (event.kind !== "unit") return;
    const variant = queueCellWave(event.type, event.unitIndex);
    let detail = `${event.label}完成・${cheerLines[event.type][variant]}`;
    if (event.firstReward) {
      detail = `${detail}・${event.reward}`;
      showCelebration("🎉", `首次完成${event.type === "row" ? "一行" : "一宮"}！`, event.reward);
    }
    showGameEffect("friends", `${event.label}完成，好朋友上場！`, detail, "success", `${event.type}-${variant}`);
    triggerAvatarAnim("jump");
    const totalCompleted = game.completedUnits.rows.length + game.completedUnits.columns.length + game.completedUnits.boxes.length;
    if (totalCompleted >= 18) setAvatarFace("excited", 3000);
    else if (totalCompleted >= 10) setAvatarFace("proud", 2500);
    else if (event.firstReward) setAvatarFace("love", 2500);
    else setAvatarFace("happy", 2000);
  });
}

function presentNewMilestones(milestones) {
  milestones.forEach((milestone) => {
    progress = { ...progress, coins: progress.coins + 2 };
    saveProgress(progress);
    showCelebration(milestone.icon, `本局里程碑・${milestone.name}`, `${milestone.detail}・🪙 +2`);
    showGameEffect("friends", `${milestone.name}達成！`, `${milestone.detail}，獲得 2 金幣`, "success");
    setAvatarFace("excited", 2500);
    triggerAvatarAnim("jump");
  });
}

function afterCorrectFill() {
  const { newlyCompleted, events } = collectBoardProgressEvents(game, alinMode);
  presentBoardProgressEvents(events);
  presentNewMilestones(collectNewMilestones(game));
  checkCompletion();
  return newlyCompleted;
}

function enterNumber(number) {
  const result = applyPlayerDigit(game, number, { noteMode, alinMode });
  if (result.type === "noop") return;

  if (result.type === "mistake") {
    if (result.failed) clearInterval(timerId);
    if (result.blockedByShield) showGameEffect("🛡️", "鏘！成功格擋", "護盾替你擋住這次錯誤", "shield");
    else showGameEffect("friends", game.failed ? "體力用完，好朋友也累趴了！" : "哎呀猜錯，好朋友愣住了！", alinMode ? "躺一下再繼續，阿霖模式不會失敗" : game.failed ? "休息一下，可以使用寶物或金幣復活" : "好朋友們喘口氣，再陪你試一次！", "mistake", game.failed ? "failure" : "");
    document.body.classList.add("shake");
    setTimeout(() => document.body.classList.remove("shake"), 320);
    triggerAvatarAnim("shake");
    setAvatarFace(game.failed ? "shocked" : "sad", game.failed ? 3000 : 2000);
    render();
    return;
  }

  if (result.type === "correct") {
    playSound("correct");
    const newlyCompleted = afterCorrectFill();
    render();
    if (!game.completed && !newlyCompleted.rows.length && !newlyCompleted.columns.length && !newlyCompleted.boxes.length) showGardenEel();
    return;
  }

  render();
}

function clearCell() {
  if (!clearEditableCell(game)) return;
  render();
}

function useHint() {
  const cost = currentHintCost();
  if (!game.started || game.failed || progress.coins < cost || game.puzzle[game.selected] || game.values[game.selected]) return;
  if (cost) progress = spendCoins(progress, cost);
  if (!applyHintFill(game, game.selected)) return;
  setAvatarFace("thinking", 1500);
  afterCorrectFill();
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
      removeRelatedNotes(game, target, game.values[target]);
    });
    resultDetail = `已填入 ${targets.length} 格正確答案`;
    afterCorrectFill();
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
  if (!claimRewardCard(game, cardId)) return;
  progress = addCard(progress, cardId);
  render();
  const card = TREASURE_CARDS[cardId];
  showCelebration(card.icon, `恭喜獲得「${card.name}」！`, "已放進寶物背包");
}

function checkCompletion() {
  const settlement = settleCompletedGame(game, { alinMode });
  if (!settlement) return;
  clearInterval(timerId);
  showFinaleCelebration();
  progress = rewardProgress(progress, settlement.xpReward, settlement.timeBonus, settlement.stars, game.difficulty, game.floor);
  const achievementResult = recordAchievementGame(progress, {
    perfect: settlement.perfect,
    speed: settlement.speed,
    alin: settlement.alin
  });
  progress = achievementResult.progress;
  // Belt-and-suspenders: next floor is always at least completed + 1.
  progress = raiseFloorProgress(progress, game.difficulty, nextFloorFromCompleted(game.floor));
  saveProgress(progress);
  achievementResult.unlocked.forEach((achievement, index) => {
    setTimeout(() => showCelebration(achievement.icon, `永久成就・${achievement.name}`, `${achievement.description}・🪙 +${achievement.coins}`), 3500 + index * 450);
  });
  clearSession();
  // Upload the completed floor (game.floor), not the next-floor counter.
  queueLeaderboardScore(buildScore(progress, game, alinMode))
    .then((result) => {
      applyLeaderboardSyncResult(result);
      if (game.completed) render();
    })
    .catch((error) => {
      leaderboardSyncStatus = error.message || "排行榜同步失敗，請開啟排行榜重試";
      leaderboardTauntStatus = leaderboardSyncStatus;
      if (game.completed) render();
    });
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
  equippedCards = equippedCards.filter((cardId) => progress.inventory[cardId] > 0).slice(0, 2);
  // If we just cleared a board, never re-open a lower floor than completed + 1.
  const fromLastClear = game?.completed && game?.difficulty === difficulty
    ? nextFloorFromCompleted(game.floor)
    : 1;
  const floor = Math.max(progress.floors[difficulty] || 1, fromLastClear, 1);
  if ((progress.floors[difficulty] || 1) < floor) {
    progress = raiseFloorProgress(progress, difficulty, floor);
    saveProgress(progress);
  }
  game = createAdventureGame({
    difficulty,
    floor,
    equippedCards
  });
  noteMode = false;
  showBackpack = false;
  lastWaveVariants = { row: null, column: null, box: null };
  refreshBoardBuddies();
  render();
}

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isFormControl = target instanceof HTMLElement
    && (target.matches("input, textarea, select, button") || target.isContentEditable);
  if (activeScreen === "island" || isFormControl || showNameSetup || showSaveCenter || showLeaderboard || showBackpack) return;
  if (/^[1-9]$/.test(event.key)) enterNumber(Number(event.key));
  if (["Backspace", "Delete", "0"].includes(event.key)) clearCell();
  if (event.key.toLowerCase() === "n") { noteMode = !noteMode; render(); }
});

if (restoredSession) {
  startTimer();
  if (!progress.playerAvatar) showAvatarPicker = true;
  render();
} else newGame("easy");
if (reconcileActiveSessionFloor()) render();
hydrateCloudProgress();

window.addEventListener("hashchange", () => {
  const nextScreen = location.hash === "#island" ? "island" : "game";
  if (nextScreen === activeScreen) return;
  activeScreen = nextScreen;
  if (activeScreen === "island") ensureIsland();
  else {
    clearInterval(islandClockId);
    islandClockId = undefined;
  }
  render();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && activeScreen === "island") renderIslandView();
});

window.addEventListener("online", () => {
  flushPendingScores().catch(() => {});
  syncCloudNow(false);
});
flushPendingScores().catch(() => {});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register(new URL("sw.js", document.baseURI)).catch(() => {});
}
