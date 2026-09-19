import { playSound, resumeAudio, setSoundEnabled, stopAudio } from "./game/audio.js?v=v62";
import { advanceGameClock } from "./game/timer.js?v=v62";
import { readLocal, writeLocal, storageWarning, retryLocalWrites } from "./state/storage.js?v=v62";
import { DIFFICULTIES, VARIANTS, gameModeKey, parseGameModeKey, relatedCells } from "./game/sudoku.js?v=v62";
import { activateAutomaticTreasures, ADVENTURE_RULES, applyHintTreasure, applyImmediateTreasure, strongestEquippedRevive, sudokuUnitCells, TREASURE_AUTO_EFFECTS, TREASURE_CARDS } from "./game/adventure.js?v=v62";
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
} from "./game/flow.js?v=v62";
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_SERIES, achievementById, achievementRewardText, achievementSeriesProgress, achievementValue, equipAchievementReward, equippedAchievementReward, normalizeAchievementStats, recordAchievementGame } from "./game/achievements.js?v=v62";
import { chooseFriendPair, chooseGardenEel, choosePartyFriends, FRIEND_ROSTER, nextDanceVariants } from "./game/friends.js?v=v62";
import { ISLAND_TEST_MODE } from "./island/catalog.js?v=v62";
import { availableInventoryQuantity, dismissIslandLetter, availableConstructionWorkerIds, availableHelperIds, collectFacility, createIslandState, finishIslandWork, hireConstructionHelper, marketSale, normalizeIslandState, selectSourceRecipe, settleIsland, startBuilding, startDemolition, startHomeUpgrade, startProcessing, startReclamation } from "./island/model.js?v=v62";
import { DEMO_ISLAND_PARTNERS, dispatchDemoShipment, LOGISTICS_METHODS, mergeCloudLogistics, networkProfileSnapshot, normalizeIslandPartner, partnerLogisticsOffers, recordDispatchedShipment, shipmentQuote } from "./island/logistics.js?v=v62";
import { formatIslandDuration, renderIslandScreen } from "./island/renderer.js?v=v62";
import { cloudConfigured, loadCloudPin, loadCloudProgress, normalizePlayerName, renameCloudPlayer, saveCloudPin, saveCloudProgress, saveCloudProgressIfCurrent, validCloudPin } from "./state/cloud.js?v=v62";
import { acknowledgeIslandLogistics, dispatchIslandShipment, getIslandLogistics, listIslandPartners, publishIslandNetwork } from "./state/island-cloud.js?v=v62";
import { buildScore, fetchLeaderboard, fetchPlayerLeaderboardRows, flushPendingScores, leaderboardConfigured, normalizeLeaderboardTaunt, pendingScoreCount, queueLeaderboardScore, updateLeaderboardAvatar, updateLeaderboardTaunt } from "./state/leaderboard.js?v=v62";
import { addCard, clearSession, consumeCard, exportSaveCode, importSaveCode, loadProgress, loadSession, mergeProgressHighWater, nextFloorFromCompleted, parseSaveCode, preferSaveSide, raiseFloorProgress, reconcileFloorsFromLeaderboardRows, rewardProgress, saveProgress, saveSession, saveTimestampMs, sessionFloorBehindProgress, spendCoins } from "./state/store.js?v=v62";

const app = document.querySelector("#app");
const APP_VERSION = "v62";
const APP_LAST_UPDATED = "2026-09-19T22:31:48+08:00";
let progress = loadProgress();
const migratedAchievements = recordAchievementGame(progress);
progress = migratedAchievements.progress;
if (migratedAchievements.changed) saveProgress(progress, { touch: false });
const restoredSession = loadSession();
let game = restoredSession?.game || createAdventureGame({ difficulty: "easy", floor: 1 });
let generatingGame = null;
let noteMode = false;
let alinMode = restoredSession?.alinMode || false;
alignVariantSessionFloor();
let showBackpack = false;
let showSaveCenter = false;
let showNameSetup = !progress.playerName;
let showLeaderboard = false;
let showAchievements = false;
let achievementCategory = "all";
let achievementFilter = "all";
let achievementPreviewId = "";
let achievementReturnFocusId = "open-achievements";
const achievementOpenSeries = new Set();
let showAvatarPicker = false;
let leaderboardDifficulty = gameModeKey(game.variant, game.difficulty, alinMode);
let leaderboardRequest = 0;
let leaderboardRows = [];
let leaderboardStatus = "";
let leaderboardTauntStatus = "";
let leaderboardSyncStatus = "";
let nameSetupStatus = "";
let cloudSyncStatus = "";
let cloudSyncTimer;
let cloudSyncInFlight = null;
let cloudSyncAgain = false;
let cloudHydrationPending = cloudConfigured() && Boolean(progress.playerName) && validCloudPin(loadCloudPin());
let equippedCards = restoredSession?.equippedCards || [];
let timerId;
let sessionSaveTimer;
let timerLastTick = performance.now();
let timerWasActive = false;
const effectTimers = new Set();
let celebrationId = 0;
let gameEffectQueue = [];
let gameEffectActive = false;
let cellWaveQueue = [];
let cellWaveActive = false;
let lastWaveVariants = { row: null, column: null, box: null };
const SOUND_KEY = "sudox-sound-enabled-v1";
let soundEnabled = readLocal(SOUND_KEY) !== "off";
setSoundEnabled(soundEnabled);
let lastFinaleMelody = -1;
let lastFriendPairKey = "";
let danceVariantCursor = 0;
/** Three random stickers perched on the board frame (refreshed each new game). */
let boardBuddyIds = [];
let activeScreen = location.hash === "#island" ? "island" : "game";
let island = null;
let islandSelectedKey = "0,1";
let islandSelectedWorkerId = "";
let islandSelectedBuildingId = "";
let islandZoom = innerWidth > 900
  ? Math.max(0.62, Math.min(0.98, (innerHeight - 240) / 504))
  : 0.78;
let islandMapPosition = null;
let islandStatus = "";
let islandClockId;
let islandPartners = [];
let islandSelectedPartnerId = "";
let islandSelectedShipmentId = "";
let islandShowStats = false;
let islandNetworkStatus = "";
let islandNetworkBusy = false;

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
  effectTimers.delete(avatarFaceTimer);
  avatarFace = face;
  avatarFaceIndex++;
  avatarFaceTimer = effectTimeout(() => {
    avatarFace = "idle";
    const bubble = document.querySelector(".avatar-bubble");
    if (bubble) bubble.textContent = getAvatarFace();
  }, duration);
}
const currentHintCost = () => alinMode ? 0 : DIFFICULTIES[game.difficulty].hintCost;
const progressDifficulty = (difficulty = game?.difficulty, mode = alinMode, variant = game?.variant) => gameModeKey(variant || "classic", difficulty, mode);
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

function playFinaleMelody() {
  const choices = [0, 1, 2].filter((index) => index !== lastFinaleMelody);
  lastFinaleMelody = choices[Math.floor(Math.random() * choices.length)];
  playSound(`finale-${lastFinaleMelody}`);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  setSoundEnabled(soundEnabled);
  writeLocal(SOUND_KEY, soundEnabled ? "on" : "off");
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
  effectTimeout(() => el.classList.remove(anim), 800);
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
  const frame = equippedAchievementReward(progress, "avatarFrame");
  const wrapGameAvatar = (markup) => hasLeaderboardRow ? markup : `<div class="game-avatar-anchor ${frame ? `achievement-frame frame-tier-${frame.achievement.tier}` : ""}" ${frame ? `style="--achievement-color:${frame.achievement.color};--frame-symbol:'${frame.achievement.icon}'" aria-label="${escapeHtml(frame.label)}"` : ""}>${markup}</div>`;
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
  board.querySelector(".garden-eel-peek")?.remove();
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
  effectTimeout(() => eel.remove(), 2500);
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
  effectTimeout(() => {
    toast.classList.add("leaving");
    toast.addEventListener("animationend", () => {
      toast.remove();
      if (!stack.children.length) stack.remove();
    }, { once: true });
  }, 2600);
}

function effectTimeout(callback, delay) {
  const id = setTimeout(() => { effectTimers.delete(id); callback(); }, delay);
  effectTimers.add(id);
  return id;
}

function resetGameEffects() {
  for (const id of effectTimers) clearTimeout(id);
  effectTimers.clear();
  document.querySelectorAll(".wave-hop").forEach((cell) => {
    cell.classList.remove("wave-hop", "wave-row", "wave-column", "wave-box", "wave-variant-0", "wave-variant-1");
    cell.style.removeProperty("--wave-delay");
  });
  gameEffectQueue = [];
  gameEffectActive = false;
  cellWaveQueue = [];
  cellWaveActive = false;
  avatarFace = "idle";
  stopAudio();
  document.querySelectorAll(".game-effect, .finale-overlay, #celebration-stack, .garden-eel-peek").forEach((element) => element.remove());
  document.body.classList.remove("shake", "flash-success", "flash-mistake", "flash-shield", "flash-card");
}

function showGameEffect(icon, title, detail, tone = "success", motion = "", placement = "viewport") {
  playSound(motion || tone);
  // Decorative feedback must not build up seconds behind the player's input.
  if (gameEffectQueue.length >= 2) gameEffectQueue.shift();
  gameEffectQueue.push({ icon, title, detail, tone, motion, placement });
  playNextGameEffect();
}

function playNextGameEffect() {
  if (gameEffectActive || !gameEffectQueue.length) return;
  gameEffectActive = true;
  const { icon, title, detail, tone, motion, placement } = gameEffectQueue.shift();
  const hasFriends = icon === "friends";
  const boardEdge = placement === "board-edge";
  const effect = document.createElement("section");
  effect.className = `game-effect ${tone}${hasFriends ? " has-friends" : ""}${boardEdge ? " board-edge" : ""}${motion ? ` motion-${motion}` : ""}`;
  if (boardEdge) {
    const board = document.querySelector(".sudoku-board");
    let boardRect = board?.getBoundingClientRect();
    if (boardRect && boardRect.top < 104) {
      window.scrollBy({ top: boardRect.top - 104, behavior: "instant" });
      boardRect = board.getBoundingClientRect();
    }
    if (boardRect) {
      effect.style.setProperty("--board-edge-x", `${boardRect.left + boardRect.width / 2}px`);
      effect.style.setProperty("--board-edge-y", `${boardRect.top - 10}px`);
    }
  }
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
  document.body.classList.remove("flash-success", "flash-mistake", "flash-shield", "flash-card");
  document.body.classList.add(`flash-${tone}`);
  effectTimeout(() => document.body.classList.remove(`flash-${tone}`), 780);
  // Faint WebPs run ~2.7s; dances are shorter loops — keep toast long enough to read.
  const holdMs = tone === "mistake" ? 2800 : 1750;
  effectTimeout(() => {
    effect.remove();
    gameEffectActive = false;
    playNextGameEffect();
  }, holdMs);
}

function queueCellWave(type, unitIndex) {
  const previous = lastWaveVariants[type];
  const variant = previous === null ? (Math.random() < 0.5 ? 0 : 1) : 1 - previous;
  lastWaveVariants[type] = variant;
  if (cellWaveQueue.length >= 2) cellWaveQueue.shift();
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
  effectTimeout(() => {
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
  effectTimeout(() => finale.classList.add("leaving"), 4200);
  effectTimeout(() => finale.remove(), 4800);
}

function sessionSnapshot() {
  return { game, equippedCards, alinMode };
}

// Sudoku boards and timers stay on this device. Cloud saves carry durable progress
// (including floors and island state) but never an active in-progress session.
function cloudProgressSaveCode(nextProgress = progress) {
  return exportSaveCode(nextProgress, null);
}

function persistSession() {
  clearTimeout(sessionSaveTimer);
  const session = sessionSnapshot();
  if (session && !game.completed) saveSession(session);
  else clearSession();
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
    coinDelta: ISLAND_TEST_MODE ? 0 : result.coinsEarned,
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

function islandViewScrollSnapshot() {
  const shell = document.querySelector(".island-shell");
  if (!shell) return null;
  const panel = shell.querySelector(".island-control-panel");
  const workerPicker = shell.querySelector(".island-worker-picker > div");
  return {
    selectedKey: shell.querySelector(".island-hex.is-selected")?.dataset.islandCell || "",
    windowX: window.scrollX,
    windowY: window.scrollY,
    panelScrollTop: panel?.scrollTop || 0,
    workerPickerScrollTop: workerPicker?.scrollTop || 0,
    buildCategories: [...shell.querySelectorAll(".island-build-category")].map((category) => category.open)
  };
}

function restoreIslandViewScroll(snapshot) {
  if (!snapshot || snapshot.selectedKey !== islandSelectedKey) return;
  window.scrollTo(snapshot.windowX, snapshot.windowY);
  const panel = document.querySelector(".island-control-panel");
  const workerPicker = document.querySelector(".island-worker-picker > div");
  if (panel) panel.scrollTop = snapshot.panelScrollTop;
  if (workerPicker) workerPicker.scrollTop = snapshot.workerPickerScrollTop;
  document.querySelectorAll(".island-build-category").forEach((category, index) => {
    if (snapshot.buildCategories[index] !== undefined) category.open = snapshot.buildCategories[index];
  });
}

function renderIslandView() {
  updateGameClock();
  if (!island) ensureIsland();
  if (!islandClockId) islandClockId = setInterval(refreshIslandClock, 1000);
  settleIslandNow();
  const workers = ensureIslandSelectedWorker();
  const scrollSnapshot = islandViewScrollSnapshot();
  app.innerHTML = renderIslandScreen({
    state: island,
    coins: progress.coins,
    selectedKey: islandSelectedKey,
    zoom: islandZoom,
    status: islandStatus,
    partners: islandPartners,
    selectedPartnerId: islandSelectedPartnerId,
    selectedShipmentId: islandSelectedShipmentId,
    showStats: islandShowStats,
    selectedBuildingId: islandSelectedBuildingId,
    networkStatus: islandNetworkStatus,
    networkBusy: islandNetworkBusy,
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
  restoreIslandViewScroll(scrollSnapshot);
  if (scrollSnapshot) {
    requestAnimationFrame(() => restoreIslandViewScroll(scrollSnapshot));
    setTimeout(() => restoreIslandViewScroll(scrollSnapshot), 120);
  }
  refreshIslandClock();
}

function openIsland() {
  resetGameEffects();
  persistSession();
  activeScreen = "island";
  history.replaceState(null, "", `${location.pathname}${location.search}#island`);
  ensureIsland();
  clearInterval(islandClockId);
  islandClockId = setInterval(refreshIslandClock, 1000);
  renderIslandView();
  refreshIslandNetwork();
}

function closeIsland() {
  clearInterval(islandClockId);
  islandClockId = undefined;
  activeScreen = "game";
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  render();
}

async function saveIslandCloudSnapshot() {
  const pin = loadCloudPin();
  if (!cloudConfigured() || !validCloudPin(pin) || !progress.playerName) return false;
  clearTimeout(cloudSyncTimer);
  return syncCloudNow(false);
}

function useDemoIslandPartners(message) {
  islandPartners = ISLAND_TEST_MODE ? DEMO_ISLAND_PARTNERS.map(normalizeIslandPartner).filter(Boolean) : [];
  islandNetworkStatus = message;
  if (!islandPartners.some((partner) => partner.id === islandSelectedPartnerId)) islandSelectedPartnerId = "";
}

async function refreshIslandNetwork() {
  if (islandNetworkBusy || activeScreen !== "island") return;
  if (cloudHydrationPending) {
    islandNetworkStatus = "正在先核對完整雲端存檔，完成後再公開小島設施。";
    renderIslandView();
    setTimeout(refreshIslandNetwork, 1000);
    return;
  }
  const pin = loadCloudPin();
  if (!navigator.onLine || !cloudConfigured() || !validCloudPin(pin) || !progress.playerName) {
    useDemoIslandPartners(ISLAND_TEST_MODE ? "目前使用測試島友；設定有效家庭 PIN 並連線後即可讀取真實玩家。" : "需要網路與有效家庭 PIN 才能使用跨島物流。");
    renderIslandView();
    return;
  }

  islandNetworkBusy = true;
  islandNetworkStatus = "正在核對島友設施與到站貨物…";
  renderIslandView();
  try {
    const snapshot = networkProfileSnapshot(island, islandOwner());
    const published = await publishIslandNetwork(snapshot, pin);
    let merged = mergeCloudLogistics(island, published);
    const [partnerRows, logistics] = await Promise.all([
      listIslandPartners(progress.playerId),
      getIslandLogistics(progress.playerId, pin)
    ]);
    merged = mergeCloudLogistics(merged.state, logistics);
    const normalizedPartners = partnerRows.map(normalizeIslandPartner).filter(Boolean);
    islandPartners = normalizedPartners.length ? normalizedPartners : (ISLAND_TEST_MODE ? DEMO_ISLAND_PARTNERS.map(normalizeIslandPartner).filter(Boolean) : []);
    if (!islandPartners.some((partner) => partner.id === islandSelectedPartnerId)) islandSelectedPartnerId = "";

    const changed = JSON.stringify(merged.state) !== JSON.stringify(island) || merged.coinsEarned > 0;
    if (changed) {
      commitIsland(merged.state, {
        coinDelta: ISLAND_TEST_MODE ? 0 : merged.coinsEarned,
        status: merged.coinsEarned ? `跨島貨物已送達，收到 🪙 ${merged.coinsEarned}。` : islandStatus,
        rerender: false
      });
    }

    if (merged.ackInboundIds.length || merged.ackRewardIds.length) {
      await saveIslandCloudSnapshot();
      await acknowledgeIslandLogistics(progress.playerId, pin, merged.ackInboundIds, merged.ackRewardIds);
    }
    islandNetworkStatus = normalizedPartners.length
      ? `已同步 ${normalizedPartners.length} 位島友；離線期間抵達的貨物也已結算。`
      : "目前沒有公開相容設施的玩家，暫時顯示測試島友。";
  } catch (error) {
    useDemoIslandPartners(ISLAND_TEST_MODE ? `${error.message || "物流連線失敗"}；目前改用測試島友。` : (error.message || "物流連線失敗"));
  } finally {
    islandNetworkBusy = false;
    if (activeScreen === "island") renderIslandView();
  }
}

function logisticsFormSelection(form) {
  const partner = islandPartners.find((entry) => entry.id === form.dataset.islandPartnerId);
  const offer = partnerLogisticsOffers(island, partner).find((entry) => entry.id === form.elements.offer?.value);
  return { partner, offer, methodId: form.elements.method?.value || "", quantity: Number(form.elements.quantity?.value) || 0 };
}

function islandOperationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function updateIslandLogisticsQuote(form) {
  const selection = logisticsFormSelection(form);
  if (!selection.partner || !selection.offer) return;
  const methodDefinition = LOGISTICS_METHODS[selection.methodId] || null;
  const quantityInput = form.elements.quantity;
  if (quantityInput) {
    quantityInput.min = 1;
    quantityInput.step = 1;
    if (methodDefinition) quantityInput.max = String(methodDefinition.capacity);
    selection.quantity = Number(quantityInput.value);
  }
  const quote = shipmentQuote(island, selection);
  const quoteElement = form.querySelector("[data-island-logistics-quote]");
  const stockElement = form.querySelector("[data-island-logistics-stock]");
  if (stockElement) stockElement.textContent = `${selection.offer.itemId ? "📦" : ""} ×${availableInventoryQuantity(island, selection.offer.itemId)} 可用`;
  if (quoteElement) quoteElement.textContent = quote.ok
    ? `${quote.method.icon} ${formatIslandDuration(quote.durationSeconds)}後送達・可收 🪙 ${quote.rewardCoins}（本島市場僅 🪙 ${quote.localMarketCoins}）${quote.feeCoins ? `・運費 🪙 ${quote.feeCoins}` : ""}`
    : quote.error;
  form.querySelector('button[type="submit"]')?.toggleAttribute("disabled", islandNetworkBusy || !quote.ok);
}

async function submitIslandShipment(form) {
  if (islandNetworkBusy) return;
  const selection = logisticsFormSelection(form);
  const quote = shipmentQuote(island, selection);
  if (!quote.ok) {
    islandStatus = quote.error;
    renderIslandView();
    return;
  }
  if (!ISLAND_TEST_MODE && progress.coins < quote.feeCoins) {
    islandStatus = `空運費不足，還需要 🪙 ${quote.feeCoins - progress.coins}。`;
    renderIslandView();
    return;
  }

  islandNetworkBusy = true;
  islandStatus = `正在安排${quote.method.name}…`;
  renderIslandView();
  try {
    let result;
    if (selection.partner.isDemo) {
      result = dispatchDemoShipment(island, selection);
    } else {
      const operationId = islandOperationId();
      const cloudResult = await dispatchIslandShipment({
        operationId,
        senderId: progress.playerId,
        pin: loadCloudPin(),
        receiverId: selection.partner.id,
        facilityInstanceId: selection.offer.facilityInstanceId,
        recipeId: selection.offer.recipeId,
        itemId: selection.offer.itemId,
        quantity: quote.quantity,
        methodId: selection.methodId
      });
      result = recordDispatchedShipment(island, { shipment: cloudResult.shipment });
      if (result.ok) result.state = mergeCloudLogistics(result.state, cloudResult).state;
    }
    if (!result.ok) throw new Error(result.error || "無法建立物流任務");
    commitIsland(result.state, {
      coinDelta: ISLAND_TEST_MODE ? 0 : -quote.feeCoins,
      status: `${quote.method.icon} 已載著 ${quote.quantity} 份貨物前往 ${selection.partner.name}！`,
      rerender: false
    });
    if (!selection.partner.isDemo) {
      try {
        await saveIslandCloudSnapshot();
      } catch {
        scheduleCloudSync();
        islandStatus = `${quote.method.icon} 貨物已成功出發；完整存檔暫時未同步，系統會自動重試。`;
      }
    }
  } catch (error) {
    islandStatus = error.message || "物流出貨失敗，本機庫存未變更。";
  } finally {
    islandNetworkBusy = false;
    renderIslandView();
  }
}

function refreshIslandClock() {
  if (activeScreen !== "island" || !island) return;
  const now = Date.now();
  document.querySelectorAll("[data-island-ready-at]").forEach((element) => {
    const readyAt = Number(element.dataset.islandReadyAt) || 0;
    element.textContent = formatIslandDuration((readyAt - now) / 1000);
  });
  if (settleIslandNow(now)) renderIslandView();
}

function affordIslandResult(result, successStatus, beforeCommit = null) {
  if (!result.ok) {
    islandStatus = result.error || "目前無法執行這項操作。";
    renderIslandView();
    return false;
  }
  if (!ISLAND_TEST_MODE && progress.coins < result.costCoins) {
    islandStatus = `金幣不足，還需要 🪙 ${result.costCoins - progress.coins}。`;
    renderIslandView();
    return false;
  }
  beforeCommit?.();
  commitIsland(result.state, { coinDelta: ISLAND_TEST_MODE ? 0 : -result.costCoins, status: successStatus });
  return true;
}

async function collectIslandFacilitySafely(buildingInstanceId) {
  clearTimeout(cloudSyncTimer);
  const pin = loadCloudPin();
  const playerId = progress.playerId, playerName = progress.playerName;
  const samePlayer = () => progress.playerId === playerId && progress.playerName === playerName && loadCloudPin() === pin;
  const cloudReady = navigator.onLine && cloudConfigured() && validCloudPin(pin) && progress.playerName;
  if (cloudReady) {
    const synced = await syncCloudNow(false);
    if (!samePlayer()) return;
    if (!synced) {
      islandStatus = cloudSyncStatus || "雲端尚未確認最新狀態，為避免重複收成，請稍後再試。";
      renderIslandView();
      return;
    }
  }

  const previousProgress = progress;
  const previousIsland = island;
  const result = collectFacility(island, { buildingInstanceId });
  if (!result.ok) {
    islandStatus = result.error;
    renderIslandView();
    return;
  }
  if (!cloudReady) {
    commitIsland(result.state, { status: "產品已領取到島主小屋倉庫。" });
    return;
  }

  const expectedSaveCode = cloudProgressSaveCode(progress);
  const nextProgress = { ...progress, island: result.state };
  progress = nextProgress;
  island = result.state;
  saveProgress(progress);
  const nextSaveCode = cloudProgressSaveCode(progress);
  try {
    const committed = await saveCloudProgressIfCurrent({
      playerId: progress.playerId,
      playerName: progress.playerName,
      pin,
      saveCode: nextSaveCode,
      expectedSaveCode
    });
    if (!samePlayer()) return false;
    if (!committed) {
      const latestSaveCode = await loadCloudProgress(playerName, pin);
      if (!samePlayer()) return false;
      adoptCloudSaveCode(latestSaveCode, "這批產品已由其他裝置先收成，已同步最新狀態，未重複加入庫存。");
      return;
    }
    islandStatus = "產品已領取到島主小屋倉庫，雲端已確認這次收成。";
    renderIslandView();
  } catch (error) {
    if (!samePlayer()) return;
    progress = previousProgress;
    island = previousIsland;
    saveProgress(progress, { touch: false });
    islandStatus = error.message || "雲端尚未確認這次收成，為避免重複收成，請稍後再試。";
    renderIslandView();
  }
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
    islandSelectedPartnerId = "";
    islandSelectedShipmentId = "";
    islandSelectedBuildingId = "";
    islandShowStats = false;
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
    islandSelectedPartnerId = "";
    islandSelectedShipmentId = "";
    islandShowStats = false;
    islandStatus = "";
    renderIslandView();
  }));
  document.querySelectorAll("[data-island-partner]").forEach((button) => button.addEventListener("click", () => {
    if (button.closest("[data-island-map-viewport]")?.dataset.islandDragged === "true") return;
    islandSelectedPartnerId = button.dataset.islandPartner;
    islandSelectedShipmentId = "";
    islandShowStats = false;
    islandStatus = "";
    renderIslandView();
  }));
  document.querySelectorAll("[data-island-shipment]").forEach((button) => button.addEventListener("click", () => {
    islandSelectedShipmentId = button.dataset.islandShipment;
    islandSelectedPartnerId = "";
    islandShowStats = false;
    islandStatus = "";
    renderIslandView();
  }));
  document.querySelector("[data-island-open-stats]")?.addEventListener("click", () => {
    islandShowStats = true;
    islandSelectedPartnerId = "";
    islandSelectedShipmentId = "";
    islandStatus = "";
    renderIslandView();
  });
  document.querySelector("[data-island-refresh-network]")?.addEventListener("click", refreshIslandNetwork);
  document.querySelectorAll("[data-island-logistics-form]").forEach((form) => {
    form.addEventListener("change", () => updateIslandLogisticsQuote(form));
    form.addEventListener("input", () => updateIslandLogisticsQuote(form));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitIslandShipment(form);
    });
  });
  document.querySelector("[data-island-reclaim]")?.addEventListener("click", () => {
    const [q, r] = islandSelectedKey.split(",").map(Number);
    affordIslandResult(startReclamation(island, { q, r, workerId: islandSelectedWorkerId, playerAvatar: progress.playerAvatar || "cat" }), "伙伴已開始填海造陸！");
  });
  document.querySelectorAll("[data-island-build]").forEach((button) => button.addEventListener("click", () => {
    islandSelectedBuildingId = button.dataset.islandBuild;
    islandStatus = "";
    renderIslandView();
  }));
  document.querySelector("[data-island-confirm-build]")?.addEventListener("click", (button) => {
    const [q, r] = islandSelectedKey.split(",").map(Number);
    const buildingId = button.currentTarget.dataset.islandConfirmBuild;
    const buildingName = button.currentTarget.closest(".island-build-preview")?.querySelector("h4")?.textContent || "設施";
    affordIslandResult(startBuilding(island, { buildingId, q, r, workerId: islandSelectedWorkerId, playerAvatar: progress.playerAvatar || "cat" }), `${buildingName} 已開始施工！`, () => {
      islandSelectedBuildingId = "";
    });
  });
  document.querySelector("[data-island-upgrade-home]")?.addEventListener("click", () => {
    affordIslandResult(startHomeUpgrade(island, { workerId: islandSelectedWorkerId, playerAvatar: progress.playerAvatar || "cat" }), "島主小屋已開始擴建，完工後倉庫容量會提高！");
  });
  document.querySelectorAll("[data-island-demolish]").forEach((button) => button.addEventListener("click", () => {
    affordIslandResult(startDemolition(island, { buildingInstanceId: button.dataset.islandDemolish, workerId: islandSelectedWorkerId, playerAvatar: progress.playerAvatar || "cat" }), "伙伴已開始拆除設施；完工前該格仍會保留施工狀態。");
  }));
  document.querySelectorAll("[data-island-hire]").forEach((button) => button.addEventListener("click", () => {
    affordIslandResult(hireConstructionHelper(island, { jobId: button.dataset.islandHire, helperId: button.dataset.islandHelper }), "新伙伴加入，完工時間已提前！");
  }));
  document.querySelectorAll("[data-island-collect]").forEach((button) => button.addEventListener("click", () => {
    button.disabled = true;
    void collectIslandFacilitySafely(button.dataset.islandCollect);
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
    const result = startProcessing(island, { buildingInstanceId: button.dataset.islandBuilding, recipeId: button.dataset.islandProcess });
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
    commitIsland(result.state, { coinDelta: ISLAND_TEST_MODE ? 0 : result.coinsEarned, status: result.coinsEarned ? `測試物流已送達，獲得 🪙 ${result.coinsEarned}。` : "測試模式：工作已馬上完成。" });
  }));
  document.querySelector("[data-island-dismiss-letter]")?.addEventListener("click", (event) => {
    const result = dismissIslandLetter(island, event.currentTarget.dataset.islandDismissLetter);
    if (result.ok) commitIsland(result.state, { status: "跨島感謝函已收進物流紀錄。" });
  });
}

function scheduleSessionSave() {
  clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(persistSession, 120);
}

function render() {
  const achievements = recordAchievementGame(progress);
  if (achievements.changed) {
    progress = achievements.progress;
    saveProgress(progress, { touch: false });
    scheduleCloudSync();
  }
  updateGameClock();
  if (activeScreen === "island" && !showNameSetup) {
    scheduleSessionSave();
    ensureIsland();
    renderIslandView();
    return;
  }
  scheduleSessionSave();
  const levelTarget = progress.level * 100;
  const selectedValue = game.values[game.selected];
  const related = relatedCells(game.selected, game);
  const inventoryTotal = Object.values(progress.inventory).reduce((total, count) => total + count, 0);
  app.innerHTML = `
    <main class="shell ${game.started ? "game-active" : ""}" ${generatingGame ? "inert" : ""}>
      <header class="topbar">
        <div class="brand">${mascot()}<div><span>阿霖的數獨島</span><small>ALIN'S SUDOKU ISLAND</small></div></div>
        <div class="topbar-actions"><div class="wallet" aria-label="玩家資源"><span>⭐ ${progress.totalStars}</span><span>🪙 ${progress.coins}</span></div><button id="open-island" class="save-button">🏝️ <span>小島</span></button><button id="toggle-sound" class="save-button sound-button" aria-label="${soundEnabled ? "關閉音效" : "開啟音效"}" aria-pressed="${soundEnabled}">${soundEnabled ? "🔊" : "🔇"}</button><button id="open-achievements" class="save-button" aria-label="成就圖鑑">🏅</button><button id="open-avatar-picker" class="save-button">🐾 <span>頭像</span></button><button id="open-leaderboard" class="save-button">🏆 <span>排行</span></button><button id="open-save-center" class="save-button">💾 <span>存檔</span></button></div>
      </header>

      <section class="hero-card">
        <div><p class="eyebrow">${progress.playerName ? `${escapeHtml(progress.playerName)}・` : ""}LEVEL ${progress.level}</p><h1>今天也來解一題吧！</h1><p>每完成一局，就讓小島長大一點。</p></div>
        <div class="level-ring" style="--progress:${Math.round((progress.xp / levelTarget) * 360)}deg"><span>${progress.xp}<small>/${levelTarget} XP</small></span></div>
      </section>

      <section class="game-layout">
        <aside class="side-panel difficulty-panel">
          <div class="section-title"><span>選擇玩法</span><small>獨立模式</small></div>
          ${variantPickerMarkup()}
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
          <button class="island-card achievement-island-card" id="open-achievements-side"><span>🏅</span><div><strong>成就圖鑑</strong><small>${progress.achievements?.length || 0}/${ACHIEVEMENTS.length} 階・${progress.totalStars} 顆星</small></div></button>
        </aside>

        <section class="board-card" aria-label="數獨遊戲">
          ${boardBuddiesMarkup()}
          <div class="game-meta">
            <span class="difficulty-pill">${DIFFICULTIES[game.difficulty].icon} ${DIFFICULTIES[game.difficulty].label}・第 ${game.floor} 層</span>
            <span class="timer-block" aria-label="經過時間，沒有時間限制"><span>⏱ <strong id="timer">${formatTime(game.elapsed)}</strong></span><small>不限時 · ${formatTime(DIFFICULTIES[game.difficulty].bonusTime)} 內 +${DIFFICULTIES[game.difficulty].bonusCoins} 🪙 <i id="freeze-time">${game.frozenSeconds ? `· 凍結 ${game.frozenSeconds}s` : ""}</i></small></span>
            <button class="icon-button" id="restart" aria-label="重新開始">↻</button>
          </div>
          ${playerHonorsMarkup()}
          ${game.variant !== "classic" ? `<div class="variant-rule"><strong>${VARIANTS[game.variant].icon} ${VARIANTS[game.variant].label}</strong><span>${VARIANTS[game.variant].rule}</span></div>` : ""}
          <div class="adventure-status">
            <span class="health">${alinMode ? "🌈 不限失誤" : `${"❤️".repeat(game.health)}${"🤍".repeat(Math.max(0, game.maxHealth - game.health))}`}${game.shields ? ` 🛡️${game.shields}` : ""}</span>
            ${game.floor > 1 ? `<span class="farm-badge">♻️ 探索層：55% XP・每 3 層寶物</span>` : ""}
            <div class="goal-chips combo-chips" aria-label="連擊計數" aria-live="polite" aria-atomic="true">
              <span class="combo-chip" data-combo="correctStreak" data-count="${game.correctStreak}" title="每答對一個新格 +1；答錯或使用答案提示歸零">🔥 答對 COMBO <b>${game.correctStreak}</b></span>
              <span class="combo-chip" data-combo="unitCombo" data-count="${game.unitCombo || 0}" title="每完成一行、一列或一宮 +1；答錯或使用答案提示歸零">✨ 完成 COMBO <b>${game.unitCombo || 0}</b><small>行・列・宮</small></span>
            </div>
            <span class="run-milestone-badge">🏅 本局 ${game.milestones?.length || 0}/${RUN_MILESTONES.length}</span>
            ${avatarMarkup()}
          </div>
          <div class="board-stage">
            ${decorationMarkup(equippedAchievementReward(progress, "boardDecoration")?.achievement)}
            <div class="sudoku-board variant-${game.variant} ${game.variant !== "classic" ? "variant-board" : ""} ${game.started ? "" : "waiting"}" role="grid" aria-label="${game.started ? "數獨盤面" : "按下開始後顯示題目"}">
            ${game.values.map((value, index) => {
              const fixed = game.puzzle[index] !== 0;
              const selected = index === game.selected;
              const same = selectedValue && value === selectedValue;
              return `<button class="cell ${fixed ? "fixed" : ""} ${selected ? "selected" : ""} ${related.has(index) ? "related" : ""} ${same ? "same" : ""}" data-cell="${index}" role="gridcell" ${game.started ? "" : "disabled"} aria-label="${game.started ? cellAriaLabel(index) : "題目尚未開始"}">
                ${cellContent(index)}
              </button>`;
            }).join("")}
            ${variantOverlayMarkup()}
            </div>
          </div>
          ${game.variant !== "classic" ? `<p class="variant-cell-detail" aria-live="polite">${variantCellDetail()}</p>` : ""}
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
    ${showNameSetup ? nameSetupModal() : generatingGame ? generationModal() : showLeaderboard ? leaderboardModal() : showAchievements ? achievementModal() : showSaveCenter ? saveCenterModal() : showBackpack ? backpackModal() : showAvatarPicker ? avatarPickerModal() : !game.started ? startModal() : game.completed ? completionModal() : game.failed ? failureModal() : ""}
  `;
  bindEvents();
  syncLeaderboardStatusUi();
  playNextCellWave();
}

function variantPickerMarkup(prestart = false) {
  return `<div class="variant-picker ${prestart ? "prestart-variants" : ""}" role="group" aria-label="選擇數獨玩法">${Object.entries(VARIANTS).map(([id, item]) => `<button data-variant="${id}" aria-pressed="${game.variant === id}" ${game.started ? "disabled" : ""}><span>${item.icon}</span><strong>${item.label}</strong></button>`).join("")}</div>`;
}

function cellAriaLabel(index) {
  const value = game.values[index];
  return `第 ${Math.floor(index / 9) + 1} 列第 ${index % 9 + 1} 欄${value ? `，數字 ${value}` : "，空白"}${game.variant === "killer" ? `，籠總和 ${game.cages.find(cage => cage.cells.includes(index)).sum}` : ""}`;
}

function variantCellDetail() {
  if (!game.started) return "";
  if (game.variant === "killer") {
    const cage = game.cages.find(cage => cage.cells.includes(game.selected));
    if (!cage) return "";
    const filled = cage.cells.reduce((sum, cell) => sum + game.values[cell], 0), empty = cage.cells.filter(cell => !game.values[cell]).length;
    return `Σ 這一籠：總和 ${cage.sum}・已填 ${filled}・剩餘 ${cage.sum - filled}（${empty} 格），籠內不可重複。`;
  }
  if (game.variant === "thermo") {
    const path = game.thermometers.find(path => path.includes(game.selected));
    return path ? `🌡️ 由圓球算起第 ${path.indexOf(game.selected) + 1}／${path.length} 格，往末端的數字要更大。` : "點選溫度計上的格子，可查看它的位置。";
  }
  if (game.variant === "diagonal") return "╳ 兩條對角線各有 1–9；中央格同時屬於兩條線。";
  return "";
}

function variantOverlayMarkup() {
  if (!game.started || game.variant === "classic") return "";
  const point = cell => `${cell % 9 * 50 + 25},${Math.floor(cell / 9) * 50 + 25}`;
  let content = "";
  if (game.variant === "diagonal") content = '<path class="diagonal-line" d="M25 25 425 425M425 25 25 425"/>';
  if (game.variant === "thermo") content = game.thermometers.map(path => `<g class="thermometer"><polyline points="${path.map(point).join(" ")}"/><circle cx="${path[0] % 9 * 50 + 25}" cy="${Math.floor(path[0] / 9) * 50 + 25}" r="18"/></g>`).join("");
  if (game.variant === "killer") content = game.cages.map((cage, cageIndex) => {
    const cells = new Set(cage.cells);
    const lines = cage.cells.map(cell => {
      const x = cell % 9 * 50, y = Math.floor(cell / 9) * 50;
      return [!cells.has(cell - 9) ? `M${x+3} ${y+3}H${x+47}` : "", !cells.has(cell + 9) ? `M${x+3} ${y+47}H${x+47}` : "", (cell % 9 === 0 || !cells.has(cell - 1)) ? `M${x+3} ${y+3}V${y+47}` : "", (cell % 9 === 8 || !cells.has(cell + 1)) ? `M${x+47} ${y+3}V${y+47}` : ""].join("");
    }).join("");
    return `<path class="killer-cage" data-cage="${cageIndex}" d="${lines}"/>`;
  }).join("");
  return `<svg class="variant-overlay" viewBox="0 0 450 450" aria-hidden="true">${content}</svg>`;
}

function startModal() {
  const selectedCards = equippedCards.map((cardId) => TREASURE_CARDS[cardId]).filter(Boolean);
  return `<div class="modal-backdrop"><section class="modal start-modal" role="dialog" aria-modal="true" aria-labelledby="start-title">
    <div class="start-friends" aria-hidden="true"><span>🐱</span><span>🏝️</span><span>🐭</span></div><p class="eyebrow">FLOOR ${game.floor}</p><h2 id="start-title">出發前選寶物</h2>
    <p>先選玩法、難度與寶物，按下開始後才顯示題目並開始計時。</p>
    ${variantPickerMarkup(true)}
    <p class="prestart-rule">${VARIANTS[game.variant].rule}${game.variant === "killer" ? "<br>籠上總和就是提示。輕鬆：較多小籠；動腦：較少籠；高手：較大籠，需更多加總推理。" : ""}</p>
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
  const nextFloor = progress.floors?.[progressDifficulty()] || nextFloorFromCompleted(game.floor);
  return `<div class="modal-backdrop"><section class="modal completion-modal" role="dialog" aria-modal="true" aria-labelledby="complete-title">
    <div class="celebrate">🎉</div><p class="eyebrow">FLOOR ${game.floor} COMPLETE</p><h2 id="complete-title">第 ${game.floor} 層完成！</h2>
    <div class="stars-earned" aria-label="獲得 ${game.stars} 顆星">${"⭐".repeat(game.stars)}${"☆".repeat(3 - game.stars)}</div>
    <div class="reward-row"><span>⭐ +${game.xpReward} XP</span><span>🪙 +${totalCoins}</span></div>
    <p class="cloud-result">${leaderboardConfigured() ? "🏆 成績已加入全球排行同步佇列" : "🏆 排行榜等待連接資料庫"}</p>
    ${game.floor > 1 ? `<p class="farm-reward-note">探索層採 55% 經驗；下一局前往第 ${nextFloor} 層</p>` : ""}
    ${game.timeBonus ? `<p class="speed-bonus">⚡ 目標時間內完成，速度獎勵 +${game.timeBonus} 金幣</p>` : `<p class="speed-bonus calm">慢慢玩也很好，關卡沒有時間限制</p>`}
    ${(game.unlockedAchievementIds || []).length ? `<section class="completion-achievements"><strong>🏅 本局解鎖 ${game.unlockedAchievementIds.length} 個階段</strong><ul>${game.unlockedAchievementIds.map(achievementById).filter(Boolean).map((stage)=>`<li>${stage.icon} ${escapeHtml(stage.name)}<small>${escapeHtml(achievementRewardText(stage))}</small></li>`).join("")}</ul><button id="open-completion-achievements" class="secondary-button">查看成就與外觀</button></section>` : ""}
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

const COSMETIC_NAMES = { badge: "勳章", title: "稱號", avatarFrame: "頭像框", boardDecoration: "棋盤角飾" };

function decorationMarkup(stage) {
  if (!stage) return "";
  const patterns = {
    voyage: '<path d="m3 7 8-4 10 4 8-4v23l-8 4-10-4-8 4ZM11 3v23M21 7v23"/>',
    stars: '<path d="m16 2 4 9 10 1-8 7 2 11-8-6-8 6 2-11-8-7 10-1Z"/>',
    perfect: '<path d="m16 2 13 14-13 14L3 16ZM3 16h26M16 2v28M9 9l14 14M23 9 9 23"/>',
    accuracy: '<circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="7"/><path d="M16 1v8M16 23v8M1 16h8M23 16h8"/>',
    selfReliant: '<path d="M9 28h14L20 10h-8ZM8 10h16L16 3ZM4 6l-2-2M27 6l3-2M12 20h8"/>',
    barehand: '<path d="M3 15V3h12M17 29h12V17M8 15V8h7M17 24h7v-7"/>',
    pure: '<path d="M4 4h24v24H4ZM12 4v24M20 4v24M4 12h24M4 20h24"/><path d="m16 12 4 4-4 4-4-4Z"/>',
    hard: '<path d="M16 2c3 8 11 10 11 18a11 11 0 0 1-22 0c0-5 4-7 5-11 1 6 3 8 5 8 3-4 2-9 1-15Z"/>',
    hardPure: '<path d="m7 27 18-18 2-6-6 2L3 23M12 16l5 5M5 25l2 2M17 4l2-2"/>',
    mental: '<path d="M4 4h24v24H4ZM12 4v24M20 4v24M4 12h24M4 20h24M6 8h3M23 24h3"/>',
    speed: '<path d="M2 10h20c8 0 8-8 2-8M2 16h25M2 22h18c9 0 9 8 3 8"/>',
    hardSpeed: '<path d="M19 2 5 18h10l-2 12 14-18H17Z"/>',
    lastHeart: '<circle cx="16" cy="6" r="4"/><path d="M16 10v19M8 15h16M3 20c0 12 26 12 26 0M3 20l5 3M29 20l-5 3"/>',
    alin: '<path d="M3 27v-9a13 13 0 0 1 26 0v9M8 27v-9a8 8 0 0 1 16 0v9M13 27v-9a3 3 0 0 1 6 0v9"/>',
    allModes: '<circle cx="16" cy="16" r="13"/><path d="m16 4 4 12-4 12-4-12ZM4 16h24"/>'
  };
  return `<div class="achievement-ornaments ornament-tier-${stage.tier}" style="--achievement-color:${stage.color}" aria-hidden="true">${[0,1,2,3].map((corner) => `<span class="ornament-${corner}"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${patterns[stage.seriesId]}</svg></span>`).join("")}</div>`;
}

function playerHonorsMarkup() {
  const title = equippedAchievementReward(progress, "title");
  const badge = equippedAchievementReward(progress, "badge");
  if (!title && !badge) return "";
  return `<div class="player-honors"><span>${escapeHtml(progress.playerName)}</span>${title ? `<strong style="color:${title.achievement.color}">${escapeHtml(title.label)}</strong>` : ""}${badge ? `<span class="honor-badge" title="${escapeHtml(badge.label)}" style="--achievement-color:${badge.achievement.color}">${badge.achievement.icon}<small>${escapeHtml(badge.achievement.name)}</small></span>` : ""}</div>`;
}

function achievementPreviewMarkup(stage) {
  if (!stage) return "";
  const unlocked = progress.achievements.includes(stage.id);
  return `<section class="achievement-preview" aria-label="外觀預覽">
    <div class="cosmetic-sample" style="--achievement-color:${stage.color};--frame-symbol:'${stage.icon}'">
      <span class="sample-avatar ${stage.rewards.avatarFrame ? `achievement-frame frame-tier-${stage.tier}` : ""}">${avatarStickerMarkup(progress.playerAvatar || "cat")}</span>
      <div class="sample-board">${Array.from({ length:9 }, (_,i) => `<span>${i+1}</span>`).join("")}${stage.rewards.boardDecoration ? decorationMarkup(stage) : ""}</div>
    </div>
    <div><small>第 ${stage.tier} 階 · ${unlocked ? "已收藏" : "預覽，達標後可使用"}</small><h3>${stage.icon} ${escapeHtml(stage.name)}</h3>
    <p>${escapeHtml(achievementRewardText(stage))}</p>
    <div class="achievement-equip-actions">${Object.keys(COSMETIC_NAMES).filter((type) => stage.rewards[type]).map((type) => {
      const current = equippedAchievementReward(progress, type)?.achievement.id === stage.id;
      return `<button data-achievement-equip="${type}" data-achievement-id="${stage.id}" ${unlocked ? "" : "disabled"} aria-pressed="${current}">${current ? "已使用" : "使用"}${COSMETIC_NAMES[type]}</button>`;
    }).join("")}</div></div>
  </section>`;
}

function achievementModal() {
  const unlocked = new Set(progress.achievements || []);
  const stats = normalizeAchievementStats(progress);
  const summaries = ACHIEVEMENT_SERIES.map((series) => ({ series, ...achievementSeriesProgress(progress, series, stats) }));
  const near = summaries.filter((item) => item.next).sort((a,b) => (b.value/b.next.target) - (a.value/a.next.target)).slice(0,3);
  const visible = summaries.filter(({series,earned,next}) => (achievementCategory === "all" || achievementCategory === series.category)
    && (achievementFilter === "all" || (achievementFilter === "incomplete" ? next : earned.length)));
  const preview = achievementById(achievementPreviewId);
  const collection = achievementCategory === "collection";
  return `<div class="modal-backdrop"><section class="modal achievement-modal" role="dialog" aria-modal="true" aria-labelledby="achievement-title">
    <header class="achievement-header"><div><p class="eyebrow">ACHIEVEMENTS · V2</p><h2 id="achievement-title">我的成就航程</h2></div><button id="close-achievements" class="icon-button" aria-label="關閉成就圖鑑">✕</button></header>
    <p class="achievement-intro">${ACHIEVEMENT_SERIES.length} 個系列 · 已收藏 ${unlocked.size}/${ACHIEVEMENTS.length} 階<br>一路累積，逐階解鎖；每階獎勵領一次，進度不歸零。</p>
    <nav class="achievement-tabs" aria-label="成就分類">${[{id:"all",icon:"🏅",name:"全部"},...ACHIEVEMENT_CATEGORIES,{id:"collection",icon:"🎨",name:"我的收藏"}].map((category)=>`<button data-achievement-category="${category.id}" aria-pressed="${achievementCategory===category.id}">${category.icon} ${category.name}</button>`).join("")}</nav>
    ${preview ? achievementPreviewMarkup(preview) : ""}
    ${collection ? `<section class="cosmetic-collection"><h3>搭配我的外觀</h3><p>勳章、稱號、頭像框與棋盤角飾可各選一款。選擇後自動保存。</p>${Object.entries(COSMETIC_NAMES).map(([type,label]) => {
      const options = ACHIEVEMENTS.filter((stage) => unlocked.has(stage.id) && stage.rewards[type]);
      const current = equippedAchievementReward(progress,type)?.achievement.id || "";
      return `<label>${label}<select data-achievement-select="${type}" aria-label="${label}"><option value="">不使用${label}</option>${options.map((stage)=>`<option value="${stage.id}" ${current===stage.id?"selected":""}>${escapeHtml(stage.rewards[type])}</option>`).join("")}</select></label>`;
    }).join("")}<div class="collection-badges">${ACHIEVEMENTS.filter((stage)=>unlocked.has(stage.id)).map((stage)=>`<button data-achievement-preview="${stage.id}" title="${escapeHtml(stage.name)}" style="--achievement-color:${stage.color}"><b>${stage.icon}</b><span>${escapeHtml(stage.name)}</span><small>第 ${stage.tier} 階</small></button>`).join("") || '<p>完成第一局，就能收藏第一枚勳章。</p>'}</div></section>` : `
    ${achievementCategory==="all" && near.length ? `<div class="achievement-near"><strong>下一站</strong>${near.map((item)=>`<button data-achievement-jump="${item.series.id}">${item.series.icon} ${escapeHtml(item.next.name)} <b>${item.value}/${item.next.target}</b></button>`).join("")}</div>` : ""}
    <label class="achievement-filter">顯示<select id="achievement-filter"><option value="all" ${achievementFilter==="all"?"selected":""}>所有系列</option><option value="incomplete" ${achievementFilter==="incomplete"?"selected":""}>尚未滿階</option><option value="earned" ${achievementFilter==="earned"?"selected":""}>已有收藏</option></select></label>
    <div class="achievement-series-list">${visible.map(({series,earned,next,current,value})=>`<details class="achievement-series ${next?"":"complete"}" data-achievement-series="${series.id}" ${achievementOpenSeries.has(series.id)?"open":""}>
      <summary><span class="series-emblem" style="--achievement-color:${(current||series.stages[0]).color}">${series.icon}<small>${earned.length}/${series.stages.length} 階</small></span><span class="series-overview"><strong>${series.name}</strong><span>${current ? `目前：${escapeHtml(current.name)}` : "尚未啟航"}</span><b>${next ? `下一階：${escapeHtml(next.name)} · ${value}/${next.target}` : "全階完成，收藏圓滿！"}</b><progress max="${(next||series.stages.at(-1)).target}" value="${value}" aria-label="${series.name}下一階進度"></progress></span><span class="series-expand" aria-hidden="true">⌄</span></summary>
      <p class="series-rule">${escapeHtml(series.rule)}</p>
      <ol class="achievement-stage-list">${series.stages.map((stage)=>`<li class="achievement-stage ${unlocked.has(stage.id)?"unlocked":"locked"}" style="--achievement-color:${stage.color}"><span class="stage-medal">${unlocked.has(stage.id)?stage.icon:"🔒"}<small>${stage.target}</small></span><div><strong>第 ${stage.tier} 階 · ${escapeHtml(stage.name)}</strong><p>${escapeHtml(stage.description)}</p><small>${escapeHtml(achievementRewardText(stage))}</small><span class="stage-status">${unlocked.has(stage.id)?"✓ 已收藏":`${achievementValue(progress,stage,stats)}/${stage.target}`}</span></div><button data-achievement-preview="${stage.id}">預覽</button></li>`).join("")}</ol>
    </details>`).join("") || '<p class="achievement-empty">這個分類目前沒有符合條件的系列。</p>'}</div>`}
  </section></div>`;
}

function bindAchievementEvents() {
  document.querySelector(".achievement-modal")?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); closeAchievements(); }
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll("button:not(:disabled), select, summary")].filter((element) => element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  const rerender = (keepScroll = false) => {
    const top = document.querySelector(".achievement-modal")?.scrollTop || 0;
    const active = document.activeElement;
    const attribute = ["data-achievement-select", "data-achievement-equip", "data-achievement-category"].find((key) => active?.hasAttribute(key));
    const selector = attribute ? `[${attribute}="${active.getAttribute(attribute)}"]` : active?.id ? `#${active.id}` : "#close-achievements";
    render();
    document.querySelector(selector)?.focus({ preventScroll: true });
    if (keepScroll) document.querySelector(".achievement-modal").scrollTop = top;
  };
  document.querySelectorAll("[data-achievement-series]").forEach((details) => details.addEventListener("toggle", () => {
    if (details.open) achievementOpenSeries.add(details.dataset.achievementSeries);
    else achievementOpenSeries.delete(details.dataset.achievementSeries);
  }));
  document.querySelectorAll("[data-achievement-category]").forEach((button) => button.addEventListener("click", () => { achievementCategory = button.dataset.achievementCategory; achievementPreviewId = ""; rerender(); }));
  document.querySelector("#achievement-filter")?.addEventListener("change", (event) => { achievementFilter = event.target.value; rerender(); });
  document.querySelectorAll("[data-achievement-preview]").forEach((button) => button.addEventListener("click", () => { achievementPreviewId = button.dataset.achievementPreview; rerender(); document.querySelector(".achievement-preview")?.scrollIntoView({block:"nearest"}); }));
  document.querySelectorAll("[data-achievement-equip]").forEach((button) => button.addEventListener("click", () => { progress = equipAchievementReward(progress, button.dataset.achievementEquip, button.dataset.achievementId); saveProgress(progress); rerender(true); }));
  document.querySelectorAll("[data-achievement-select]").forEach((select) => select.addEventListener("change", () => { progress = equipAchievementReward(progress, select.dataset.achievementSelect, select.value); saveProgress(progress); achievementPreviewId = select.value; rerender(true); }));
  document.querySelectorAll("[data-achievement-jump]").forEach((button) => button.addEventListener("click", () => {
    achievementFilter = "all"; achievementOpenSeries.add(button.dataset.achievementJump); rerender();
    document.querySelector(`[data-achievement-series="${button.dataset.achievementJump}"]`)?.scrollIntoView({block:"nearest"});
  }));
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

function rankingLabel(key) {
  const mode = parseGameModeKey(key);
  if (!mode) return "此榜單";
  return `${VARIANTS[mode.variant].label}・${LEADERBOARD_MODES[mode.difficulty].label}${mode.assisted && mode.difficulty !== "alin" ? "・阿霖輔助" : ""}`;
}

function rankingTabsMarkup() {
  const mode = parseGameModeKey(leaderboardDifficulty);
  const difficulties = mode.variant === "classic" ? LEADERBOARD_MODES : DIFFICULTIES;
  return `<div class="leaderboard-tabs ranking-modes" aria-label="排行榜模式">${Object.entries(VARIANTS).map(([key, item]) => `<button data-rank-variant="${key}" aria-pressed="${mode.variant === key}" class="${mode.variant === key ? "active" : ""}">${item.icon} ${item.label}</button>`).join("")}</div>
    <div class="leaderboard-tabs ranking-difficulties" aria-label="排行榜難度">${Object.entries(difficulties).map(([difficulty, item]) => {
      const key = difficulty === "alin" ? "alin" : gameModeKey(mode.variant, difficulty, mode.variant !== "classic" && mode.assisted);
      return `<button data-rank-difficulty="${key}" aria-pressed="${leaderboardDifficulty === key}" class="${leaderboardDifficulty === key ? "active" : ""}">${item.icon} ${item.label}</button>`;
    }).join("")}</div>
    ${mode.variant !== "classic" ? `<div class="leaderboard-tabs ranking-assist" aria-label="是否使用阿霖輔助">${[false, true].map(assisted => `<button data-rank-difficulty="${gameModeKey(mode.variant, mode.difficulty, assisted)}" aria-pressed="${mode.assisted === assisted}" class="${mode.assisted === assisted ? "active" : ""}">${assisted ? "🌈 阿霖輔助" : "一般挑戰"}</button>`).join("")}</div>` : mode.difficulty === "alin" ? '<p class="ranking-note">保留原有經典阿霖榜，三種難度共用。</p>' : ""}
    <p class="ranking-note">${rankingLabel(leaderboardDifficulty)}・各模式難度獨立比較</p>`;
}

function leaderboardModal() {
  const configured = leaderboardConfigured();
  const myRow = leaderboardRows.find((row) => row.player_id === progress.playerId);
  const modeLabel = rankingLabel(leaderboardDifficulty);
  const tauntHint = myRow
    ? `只套用在「${modeLabel}」榜・最多 48 字`
    : `先在「${modeLabel}」完成一局上榜後就能留言`;
  return `<div class="modal-backdrop"><section class="modal leaderboard-modal" role="dialog" aria-modal="true" aria-labelledby="leaderboard-title">
    <div class="celebrate">🏆</div><h2 id="leaderboard-title">家庭全球排行</h2>
    ${rankingTabsMarkup()}
    ${!configured ? `<div class="empty-ranking"><strong>尚未連接資料庫</strong><small>設定 Supabase 後，家人的成績會出現在這裡。</small></div>` : leaderboardStatus ? `<div class="empty-ranking"><span class="loading-orbit">☁️</span><small>${escapeHtml(leaderboardStatus)}</small></div>` : leaderboardRows.length ? `<div class="leaderboard-list">${leaderboardRows.map((row, index) => `
      <div class="leaderboard-row ${row.player_id === progress.playerId ? "mine" : ""}"><b>${index + 1}</b>${avatarMarkup(index, row)}<span class="leaderboard-player"><strong>${escapeHtml(row.player_name)}</strong><small>${row.stars}⭐・${row.mistakes} 次失誤・${formatTime(row.elapsed_seconds)}</small>${row.taunt ? `<q>${escapeHtml(row.taunt)}</q>` : `<q class="quiet">還沒有留下嗆聲</q>`}</span><span class="leaderboard-result"><strong>第 ${row.floor} 層</strong><time datetime="${escapeHtml(row.updated_at || "")}">最後更新<br>${formatLeaderboardUpdatedAt(row.updated_at)}</time></span></div>`).join("")}</div>` : `<div class="empty-ranking"><strong>還沒有成績</strong><small>完成第一層就能成為榜首！</small></div>`}
    ${configured ? `<div class="taunt-editor"><label for="leaderboard-taunt">📣 ${escapeHtml(modeLabel)}・我的島主宣言</label><div><input id="leaderboard-taunt" maxlength="48" value="${escapeHtml(myRow?.taunt || "")}" placeholder="例如：這難度先借我坐一下！"><button id="save-leaderboard-taunt" ${myRow ? "" : "disabled"}>送出</button></div><small>${escapeHtml(leaderboardTauntStatus || tauntHint)}</small></div>` : ""}
    <p class="pending-scores">${pendingScoreCount() ? `尚有 ${pendingScoreCount()} 筆離線成績等待同步` : "每個模式、難度與輔助榜各自保留最佳成績與留言"}</p>
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
    <p>本機會隨時自動保存；連上網路後，玩家資料、寶物、XP、層數與小島會同步到家庭雲端；目前盤面、計時及待領卡片保存在這台裝置。已存在玩家的 PIN 不會因這次更新作廢。</p>
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

function cellContent(index) {
  if (!game.started) return "";
  const cage = game.variant === "killer" ? game.cages.find(cage => cage.cells[0] === index) : null;
  return (cage ? `<small class="cage-sum">${cage.sum}</small>` : "") + String(game.values[index] ? `<span class="cell-value">${game.values[index]}</span>` : (game.notes[index].length
    ? `<span class="notes">${Array.from({ length: 9 }, (_, n) => `<i>${game.notes[index].includes(n + 1) ? n + 1 : ""}</i>`).join("")}</span>` : ""));
}

function updateBoard({ save = true } = {}) {
  if (game.completed || game.failed || !document.querySelector(".sudoku-board")) { render(); return; }
  const related = relatedCells(game.selected, game);
  const selectedValue = game.values[game.selected];
  document.querySelectorAll("[data-cell]").forEach((cell) => {
    const index = Number(cell.dataset.cell), value = game.values[index];
    cell.classList.toggle("selected", index === game.selected);
    cell.classList.toggle("related", related.has(index));
    cell.classList.toggle("same", Boolean(selectedValue && value === selectedValue));
    const content = cellContent(index);
    if (cell.innerHTML.trim() !== content) cell.innerHTML = content;
    cell.setAttribute("aria-label", cellAriaLabel(index));
  });
  const text = (selector, value) => { const element = document.querySelector(selector); if (element) element.textContent = value; };
  text(".variant-cell-detail", variantCellDetail());
  text(".health", (alinMode ? "🌈 不限失誤" : "❤️".repeat(game.health) + "🤍".repeat(Math.max(0, game.maxHealth - game.health))) + (game.shields ? ` 🛡️${game.shields}` : ""));
  text(".mistakes", `${alinMode ? "🌈 阿霖模式・目前" : "本局"}答錯 ${game.mistakes} 次`);
  text(".run-milestone-badge", `🏅 本局 ${game.milestones.length}/${RUN_MILESTONES.length}`);
  text(".wallet span:last-child", `🪙 ${progress.coins}`);
  text(".avatar-bubble", getAvatarFace());
  document.querySelectorAll("[data-combo]").forEach(chip => {
    const count = game[chip.dataset.combo] || 0, previous = Number(chip.dataset.count);
    chip.dataset.count = count;
    chip.querySelector("b").textContent = count;
    if (count > previous && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      chip.getAnimations().forEach(animation => animation.cancel());
      chip.animate([{ transform: "scale(1) rotate(0)" }, { transform: "scale(1.16) rotate(-4deg)", offset: .3 }, { transform: "scale(1.1) rotate(3deg)", offset: .6 }, { transform: "scale(1) rotate(0)" }], { duration: 420, easing: "ease-out" });
    }
  });
  const notes = document.querySelector("#notes");
  notes?.classList.toggle("active", noteMode);
  notes?.setAttribute("aria-pressed", String(noteMode));
  text("#notes small", `筆記 ${noteMode ? "開" : "關"}`);
  if (save) scheduleSessionSave();
  playNextCellWave();
}

function bindEvents() {
  bindAchievementEvents();
  document.querySelectorAll("[data-variant]").forEach(button => button.addEventListener("click", () => { if (!game.started) newGame(game.difficulty, button.dataset.variant); }));
  document.querySelector("#cancel-generation")?.addEventListener("click", () => { cancelPuzzleGeneration(); if (game.started && !game.completed && !game.failed) startTimer(); render(); });
  document.querySelector("#retry-generation")?.addEventListener("click", () => newGame(generatingGame.options.difficulty, generatingGame.options.variant));
  document.querySelectorAll("[data-cell]").forEach((button) => button.addEventListener("click", () => { game.selected = Number(button.dataset.cell); updateBoard({ save: false }); }));
  document.querySelectorAll("[data-number]").forEach((button) => button.addEventListener("click", () => enterNumber(Number(button.dataset.number))));
  document.querySelectorAll("[data-difficulty]").forEach((button) => button.addEventListener("click", () => { if (!game.started) newGame(button.dataset.difficulty); }));
  document.querySelectorAll("[data-prestart-difficulty]").forEach((button) => button.addEventListener("click", () => newGame(button.dataset.prestartDifficulty)));
  document.querySelectorAll("[data-use-card]").forEach((button) => button.addEventListener("click", () => useCard(button.dataset.useCard)));
  document.querySelectorAll("[data-equip-card]").forEach((button) => button.addEventListener("click", () => toggleEquipCard(button.dataset.equipCard)));
  document.querySelectorAll("[data-claim-card]").forEach((button) => button.addEventListener("click", () => claimCard(button.dataset.claimCard)));
  document.querySelector("#notes")?.addEventListener("click", () => { noteMode = !noteMode; updateBoard({ save: false }); });
  document.querySelector("#alin-mode")?.addEventListener("click", toggleAlinMode);
  document.querySelector("#prestart-alin-mode")?.addEventListener("click", toggleAlinMode);
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
  document.querySelector("#open-achievements")?.addEventListener("click", openAchievements);
  document.querySelector("#open-completion-achievements")?.addEventListener("click", openAchievements);
  document.querySelector("#close-achievements")?.addEventListener("click", closeAchievements);
  document.querySelector("#close-leaderboard")?.addEventListener("click", () => { showLeaderboard = false; leaderboardRequest++; render(); });
  document.querySelectorAll("[data-rank-variant]").forEach(button => button.addEventListener("click", () => {
    const current = parseGameModeKey(leaderboardDifficulty);
    changeLeaderboardDifficulty(gameModeKey(button.dataset.rankVariant, current.difficulty === "alin" ? "easy" : current.difficulty, current.assisted));
  }));
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
  achievementReturnFocusId = document.activeElement?.id || "open-achievements";
  showAchievements = true;
  render();
  document.querySelector("#close-achievements")?.focus({ preventScroll: true });
}

function closeAchievements() {
  showAchievements = false;
  render();
  document.getElementById(achievementReturnFocusId)?.focus({ preventScroll: true });
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
          saveCode: cloudProgressSaveCode(progress)
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
    await saveCloudProgress({ playerId: progress.playerId, playerName, pin, saveCode: cloudProgressSaveCode(progress) });
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
      await saveCloudProgress({ playerId: nextProgress.playerId, playerName, pin, saveCode: cloudProgressSaveCode(nextProgress) });
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
  cancelPuzzleGeneration();
  resetGameEffects();
  clearTimeout(sessionSaveTimer);
  timerWasActive = false;
  progress = mergeWithLocal
    ? mergeProgressHighWater(imported.progress, mergeWithLocal)
    : imported.progress;
  island = null;
  if (imported.session) {
    game = imported.session.game;
    equippedCards = imported.session.equippedCards || [];
    alinMode = imported.session.alinMode || false;
    alignVariantSessionFloor();
    // Session may be mid-floor while floors counter lagged — keep next-floor high water.
    if (game?.difficulty && game?.floor) {
      progress = raiseFloorProgress(progress, progressDifficulty(game.difficulty, alinMode), game.floor);
    }
  } else {
    clearSession();
    equippedCards = [];
    const fallbackDifficulty = game?.difficulty && game.difficulty !== "alin" ? game.difficulty : "easy";
    const fallbackProgressDifficulty = progressDifficulty(fallbackDifficulty, alinMode, "classic");
    game = createAdventureGame({
      difficulty: fallbackDifficulty,
      floor: progress.floors?.[fallbackProgressDifficulty] || 1,
      equippedCards
    });
    lastWaveVariants = { row: null, column: null, box: null };
  }
  saveProgress(progress, { touch: false, settledSession: null });
  persistSession();
}

// v61 variant floors mixed difficulties. Preserve its board and legacy total, not a false rank.
function alignVariantSessionFloor() {
  const key = gameModeKey(game.variant, game.difficulty, alinMode);
  if (game.variant !== "classic" && !game.completed && game.floorKey !== key) {
    game.floor = progress.floors[key] || 1;
    game.floorKey = key;
  }
}

/** Keep an active run aligned with the saved next-floor record across devices. */
function reconcileActiveSessionFloor() {
  if (!game?.difficulty || game.completed || game.failed) return false;

  const difficulty = progressDifficulty(game.difficulty, alinMode);
  if (!sessionFloorBehindProgress(progress, game, alinMode)) {
    const raised = raiseFloorProgress(progress, difficulty, game.floor);
    if (raised !== progress) {
      progress = raised;
      saveProgress(progress, { touch: false });
    }
    return false;
  }

  newGame(game.difficulty, game.variant);
  clearSession();
  return true;
}

/** Keep every next-floor counter at least one past the player's leaderboard record. */
async function reconcileLeaderboardFloorProgress() {
  if (!progress?.playerId || !leaderboardConfigured()) return false;
  try {
    const playerId = progress.playerId;
    const rows = await fetchPlayerLeaderboardRows(playerId);
    if (progress.playerId !== playerId) return false;
    const raised = reconcileFloorsFromLeaderboardRows(progress, rows);
    const modelNeedsUpgrade = progress.floorModelVersion !== 2;
    if (raised === progress && !modelNeedsUpgrade) return false;
    progress = { ...raised, floorModelVersion: 2 };
    saveProgress(progress);
    const sessionReset = reconcileActiveSessionFloor();
    if (sessionReset) render();
    scheduleCloudSync();
    return true;
  } catch {
    return false;
  }
}

function adoptCloudSaveCode(saveCode, status = "") {
  const imported = parseSaveCode(saveCode);
  progress = mergeProgressHighWater(imported.progress, progress);
  saveProgress(progress, { touch: false });
  if (JSON.stringify(progress) !== JSON.stringify(imported.progress)) scheduleCloudSync();
  island = null;
  const sessionReset = reconcileActiveSessionFloor();
  if (activeScreen === "island") {
    islandStatus = status;
    renderIslandView();
  } else {
    render();
  }
  return sessionReset;
}

async function loadExistingPlayer() {
  try {
    const { playerName, pin } = playerSetupValues();
    nameSetupStatus = "正在尋找雲端存檔…";
    document.querySelector(".name-status").textContent = nameSetupStatus;
    const saveCode = await loadCloudProgress(playerName, pin);
    applyImportedSave({ ...parseSaveCode(saveCode), session: null });
    saveCloudPin(pin);
    await reconcileLeaderboardFloorProgress();
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
  const playerId = progress.playerId;
  try {
    const saveCode = await loadCloudProgress(progress.playerName, pin);
    if (progress.playerId !== playerId || loadCloudPin() !== pin) return;
    // Parse only — never write localStorage until we know cloud is actually newer.
    const cloud = parseSaveCode(saveCode);
    const localHasSession = Boolean(sessionSnapshot() || loadSession());
    const winner = preferSaveSide(progress, cloud.progress, {
      cloudExportedAt: cloud.exportedAt,
      localHasSession,
      // Cloud stores durable progress only; ignore active sessions from pre-v57 saves.
      cloudHasSession: false
    });

    if (winner === "cloud") {
      const imported = { ...cloud, session: null };
      // Cloud wins durable fields, but never replaces the local Sudoku board.
      progress = mergeProgressHighWater(imported.progress, progress);
      saveProgress(progress, { touch: false });
      reconcileActiveSessionFloor();
      cloudSyncStatus = "已載入雲端的較新進度";
      cloudHydrationPending = false;
      scheduleCloudSync();
      if (!progress.playerAvatar) showAvatarPicker = true;
      render();
      return;
    }

    // Local is newer or equivalent — still high-water floors from cloud so we don't lag behind another device.
    const mergedLocal = mergeProgressHighWater(progress, cloud.progress);
    const progressChanged = JSON.stringify(mergedLocal) !== JSON.stringify(progress);
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
    scheduleCloudSync();
  } catch {
    // Keep the local save when cloud loading is unavailable; never overwrite a remote save blindly.
    cloudHydrationPending = false;
  }
}

function scheduleCloudSync() {
  if (cloudHydrationPending) return;
  if (cloudSyncInFlight) { cloudSyncAgain = true; return; }
  if (!cloudConfigured() || !progress.playerName || !validCloudPin(loadCloudPin())) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => syncCloudNow(false), 1800);
}

function syncCloudNow(showFeedback = false) {
  if (cloudSyncInFlight) { cloudSyncAgain = true; return cloudSyncInFlight; }
  clearTimeout(cloudSyncTimer);
  cloudSyncAgain = false;
  cloudSyncInFlight = syncCloudNowInternal(showFeedback).finally(() => {
    cloudSyncInFlight = null;
    if (cloudSyncAgain) scheduleCloudSync();
  });
  return cloudSyncInFlight;
}

async function syncCloudNowInternal(showFeedback = false) {
  const pin = loadCloudPin();
  if (!cloudConfigured() || !validCloudPin(pin) || !progress.playerName) return false;
  if (showFeedback) {
    cloudSyncStatus = "正在同步完整冒險進度…";
    render();
  }
  try {
    const playerId = progress.playerId, playerName = progress.playerName;
    const samePlayer = () => progress.playerId === playerId && progress.playerName === playerName && loadCloudPin() === pin;
    const remoteSaveCode = await loadCloudProgress(playerName, pin);
    if (!samePlayer()) return false;
    // Snapshot after the read: gameplay may have advanced while the network was waiting.
    let localSaveCode = cloudProgressSaveCode(progress);
    if (remoteSaveCode === localSaveCode) {
      cloudSyncStatus = `同步完成・${new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`;
      if (showFeedback && showSaveCenter) render();
      return true;
    }

    const remote = parseSaveCode(remoteSaveCode);
    const localTime = saveTimestampMs(progress);
    const remoteTime = saveTimestampMs(remote.progress, remote.exportedAt);
    // Only a strictly newer cloud save replaces durable progress; the board stays local.
    if (remoteTime > localTime) {
      adoptCloudSaveCode(remoteSaveCode, "已同步其他裝置的最新進度，未覆蓋雲端資料。");
      cloudSyncStatus = "已採用雲端較新版本";
      return true;
    }

    const merged = mergeProgressHighWater(progress, remote.progress);
    if (JSON.stringify(merged) !== JSON.stringify(progress)) {
      progress = merged;
      saveProgress(progress);
      localSaveCode = cloudProgressSaveCode(progress);
    }
    const committed = await saveCloudProgressIfCurrent({
      playerId: progress.playerId,
      playerName: progress.playerName,
      pin,
      saveCode: localSaveCode,
      expectedSaveCode: remoteSaveCode
    });
    if (!samePlayer()) return false;
    if (cloudProgressSaveCode(progress) !== localSaveCode) cloudSyncAgain = true;
    if (!committed) {
      if (cloudSyncAgain) return false;
      const latestSaveCode = await loadCloudProgress(playerName, pin);
      if (!samePlayer()) return false;
      if (cloudProgressSaveCode(progress) !== localSaveCode) { cloudSyncAgain = true; return false; }
      adoptCloudSaveCode(latestSaveCode, "另一台裝置已先更新，已同步雲端最新進度。");
      cloudSyncStatus = "同步衝突已保留雲端版本";
      return false;
    }
    cloudSyncStatus = `同步完成・${new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`;
    if (showFeedback && showSaveCenter) render();
    return true;
  } catch (error) {
    cloudSyncStatus = error.message || "同步失敗，本機進度不受影響";
    if (showFeedback && showSaveCenter) render();
    return false;
  }
}

async function openLeaderboardModal() {
  showLeaderboard = true;
  leaderboardDifficulty = gameModeKey(game.variant, game.difficulty, alinMode);
  leaderboardRows = [];
  leaderboardStatus = leaderboardConfigured() ? "正在讀取全球排行…" : "";
  leaderboardTauntStatus = "";
  render();
  applyLeaderboardSyncResult(await flushPendingScores());
  await refreshLeaderboard();
}

async function refreshLeaderboard() {
  if (!leaderboardConfigured()) return;
  const key = leaderboardDifficulty, request = ++leaderboardRequest;
  try {
    const rows = await fetchLeaderboard(key);
    if (request !== leaderboardRequest || key !== leaderboardDifficulty || !showLeaderboard) return;
    leaderboardRows = rows;
    leaderboardStatus = "";
  } catch (error) {
    if (request !== leaderboardRequest || key !== leaderboardDifficulty || !showLeaderboard) return;
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
  if (!parseGameModeKey(difficulty)) return;
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
  const key = leaderboardDifficulty, playerId = progress.playerId;
  const taunt = normalizeLeaderboardTaunt(document.querySelector("#leaderboard-taunt")?.value || "");
  const modeLabel = rankingLabel(leaderboardDifficulty);
  leaderboardTauntStatus = `正在送出「${modeLabel}」嗆聲…`;
  render();
  try {
    await updateLeaderboardTaunt({
      playerId: progress.playerId,
      pin,
      taunt,
      difficulty: key
    });
    if (key !== leaderboardDifficulty || playerId !== progress.playerId || !showLeaderboard) return;
    leaderboardTauntStatus = taunt
      ? `「${modeLabel}」嗆聲已更新！`
      : `已清除「${modeLabel}」嗆聲`;
    await refreshLeaderboard();
  } catch (error) {
    if (key !== leaderboardDifficulty || playerId !== progress.playerId || !showLeaderboard) return;
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
    showGameEffect("friends", `${event.label}完成，好朋友上場！`, detail, "success", `${event.type}-${variant}`, "board-edge");
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

function afterCorrectFill(manual = true) {
  const { newlyCompleted, events } = collectBoardProgressEvents(game, alinMode, { manual });
  presentBoardProgressEvents(events);
  presentNewMilestones(collectNewMilestones(game));
  checkCompletion();
  return newlyCompleted;
}

function enterNumber(number) {
  updateGameClock();
  const result = applyPlayerDigit(game, number, { noteMode, alinMode });
  if (result.type === "noop") return;

  if (result.type === "mistake") {
    if (result.failed) clearInterval(timerId);
    if (result.blockedByShield) showGameEffect("🛡️", "鏘！成功格擋", "護盾替你擋住這次錯誤", "shield");
    else showGameEffect("friends", game.failed ? "體力用完，好朋友也累趴了！" : "哎呀猜錯，好朋友愣住了！", alinMode ? "躺一下再繼續，阿霖模式不會失敗" : game.failed ? "休息一下，可以使用寶物或金幣復活" : "好朋友們喘口氣，再陪你試一次！", "mistake", game.failed ? "failure" : "");
    document.body.classList.add("shake");
    effectTimeout(() => document.body.classList.remove("shake"), 320);
    triggerAvatarAnim("shake");
    setAvatarFace(game.failed ? "shocked" : "sad", game.failed ? 3000 : 2000);
    updateBoard();
    return;
  }

  if (result.type === "correct") {
    playSound("correct");
    const newlyCompleted = afterCorrectFill();
    updateBoard();
    if (!game.completed && !newlyCompleted.rows.length && !newlyCompleted.columns.length && !newlyCompleted.boxes.length) showGardenEel();
    return;
  }

  updateBoard();
}

function clearCell() {
  if (!clearEditableCell(game)) return;
  updateBoard();
}

function useHint() {
  updateGameClock();
  const cost = currentHintCost();
  if (!game.started || game.failed || progress.coins < cost || game.puzzle[game.selected] || game.values[game.selected]) return;
  if (cost) progress = spendCoins(progress, cost);
  if (!applyHintFill(game, game.selected)) return;
  setAvatarFace("thinking", 1500);
  afterCorrectFill(false);
  updateBoard();
}

function useCard(cardId) {
  updateGameClock();
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
      if (!game.solvedCells.includes(target)) game.solvedCells.push(target);
      removeRelatedNotes(game, target, game.values[target]);
    });
    resultDetail = `已填入 ${targets.length} 格正確答案`;
  } else if (card.effect === "revive") return;
  else if (!applyImmediateTreasure(game, card, { alinMode, index })) return;
  progress = consumeCard(progress, cardId);
  game.usedCards.push(cardId);
  if (card.effect === "hint") afterCorrectFill(false);
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
  game.revivesUsed = (game.revivesUsed || 0) + 1;
  game.failed = false;
  game.health = Math.min(health, game.maxHealth);
  startTimer();
  render();
  if (source) showGameEffect(source.icon, `${source.name}發動，重新站起來！`, source.description, "card", "revive");
}

function claimCard(cardId) {
  if (!claimRewardCard(game, cardId)) return;
  progress = addCard(progress, cardId, { persist: false });
  saveProgress(progress, { settledSession: sessionSnapshot() });
  render();
  const card = TREASURE_CARDS[cardId];
  showCelebration(card.icon, `恭喜獲得「${card.name}」！`, "已放進寶物背包");
}

function checkCompletion() {
  const settlement = settleCompletedGame(game, { alinMode });
  if (!settlement) return;
  clearInterval(timerId);
  resetGameEffects();
  showFinaleCelebration();
  const completedDifficulty = progressDifficulty(game.difficulty, alinMode);
  if (progress.rewardedRuns?.includes(game.runId)) {
    game.remainingClaims = 0;
    saveProgress(progress, { touch: false, settledSession: sessionSnapshot() });
    return;
  }
  progress = rewardProgress(progress, settlement.xpReward, settlement.timeBonus, settlement.stars, completedDifficulty, game.floor, { persist: false, runId: game.runId });
  const achievementResult = recordAchievementGame(progress, settlement);
  game.unlockedAchievementIds = achievementResult.unlocked.map((stage) => stage.id);
  progress = achievementResult.progress;
  // Belt-and-suspenders: next floor is always at least completed + 1.
  progress = raiseFloorProgress(progress, completedDifficulty, nextFloorFromCompleted(game.floor));
  saveProgress(progress, { settledSession: sessionSnapshot() });
  if (achievementResult.unlocked.length) effectTimeout(() => showCelebration("🏅", `解鎖 ${achievementResult.unlocked.length} 個成就階段`, "稱號與外觀已收藏，可在成就圖鑑查看"), 3500);
  clearSession();
  // Upload the completed floor (game.floor), not the next-floor counter.
  queueLeaderboardScore(buildScore(progress, game, alinMode, { appVersion: APP_VERSION }))
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

function gameClockActive() {
  return activeScreen === "game" && document.visibilityState !== "hidden"
    && !generatingGame && game.started && !game.completed && !game.failed
    && !showNameSetup && !showSaveCenter && !showLeaderboard && !showBackpack && !showAchievements && !showAvatarPicker;
}

function updateGameClock() {
  const now = performance.now();
  if (timerWasActive) advanceGameClock(game, now - timerLastTick);
  timerLastTick = now;
  timerWasActive = gameClockActive();
  // Paused dialogs must not offer unlimited time to inspect a visible puzzle.
  document.body.classList.toggle("game-paused", game.started && !game.completed && !game.failed && !timerWasActive);
  const timer = document.querySelector("#timer"), freeze = document.querySelector("#freeze-time");
  if (timer) timer.textContent = formatTime(game.elapsed);
  if (freeze) freeze.textContent = game.frozenSeconds ? `· 凍結 ${game.frozenSeconds}s` : "";
}

function startTimer() {
  clearInterval(timerId);
  timerLastTick = performance.now();
  timerWasActive = gameClockActive();
  if (!game.started || game.completed || game.failed) return;
  timerId = setInterval(() => {
    updateGameClock();
    if (timerWasActive && game.elapsed % 10 === 0) persistSession();
  }, 1000);
}

function startGame() {
  if (generatingGame) return;
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

function cancelPuzzleGeneration() {
  if (!generatingGame) return;
  generatingGame.worker?.terminate();
  clearTimeout(generatingGame.timeout);
  generatingGame = null;
}

function generationModal() {
  const { options, error } = generatingGame;
  return `<div class="modal-backdrop"><section class="modal generation-modal" role="dialog" aria-modal="true" aria-labelledby="generation-title"><div class="celebrate">${VARIANTS[options.variant].icon}</div><h2 id="generation-title">${error ? "暫時無法出題" : `準備${VARIANTS[options.variant].label}題目`}</h2><p role="status">${error ? escapeHtml(error) : "正在確認唯一解，請稍候…"}</p>${error ? '<button id="retry-generation" class="primary-button">重試出題</button>' : ""}<button id="cancel-generation" class="secondary-button">返回原本遊戲</button></section></div>`;
}

function newGame(difficulty, variant = game?.variant || "classic") {
  if (game?.completed && game.remainingClaims > 0) return;
  if (!Object.hasOwn(VARIANTS, variant) || !Object.hasOwn(DIFFICULTIES, difficulty)) return;
  updateGameClock();
  timerWasActive = false;
  cancelPuzzleGeneration();
  resetGameEffects();
  clearTimeout(sessionSaveTimer);
  clearInterval(timerId);
  equippedCards = equippedCards.filter(cardId => progress.inventory[cardId] > 0).slice(0, 2);
  const difficultyProgress = progressDifficulty(difficulty, alinMode, variant);
  const fromLastClear = game?.completed && game?.difficulty === difficulty && game.variant === variant && (game.floorKey === difficultyProgress || (variant === "classic" && !game.floorKey)) ? nextFloorFromCompleted(game.floor) : 1;
  const floor = Math.max(progress.floors[difficultyProgress] || 1, fromLastClear, 1);
  const options = { difficulty, variant, floor, equippedCards };
  const finish = (next) => {
    next.floorKey = difficultyProgress;
    next.floor = Math.max(next.floor, progress.floors[progressDifficulty(difficulty, alinMode, variant)] || 1);
    saveProgress(progress, { touch: false, settledSession: null });
    game = next;
    noteMode = false;
    showBackpack = false;
    lastWaveVariants = { row: null, column: null, box: null };
    refreshBoardBuddies();
    render();
  };
  if (variant === "classic") { finish(createAdventureGame(options)); return; }
  const request = { options, playerId: progress.playerId, worker: null, error: "" };
  generatingGame = request;
  render();
  document.querySelector("#cancel-generation")?.focus({ preventScroll: true });
  const fail = () => {
    if (generatingGame !== request) return;
    request.worker?.terminate(); clearTimeout(request.timeout);
    request.error = "題目尚未準備完成，請重試，或返回原本遊戲。";
    render();
    document.querySelector("#retry-generation")?.focus({ preventScroll: true });
  };
  try {
    const worker = new Worker(new URL("./game/puzzle-worker.js?v=v62", import.meta.url), { type: "module" });
    request.worker = worker;
    request.timeout = setTimeout(fail, 15000);
    worker.onerror = (event) => { event.preventDefault(); fail(); };
    worker.onmessage = ({ data }) => {
      if (generatingGame !== request) return;
      if (progress.playerId !== request.playerId) { cancelPuzzleGeneration(); render(); return; }
      if (!data.game) { fail(); return; }
      cancelPuzzleGeneration();
      finish(data.game);
    };
    worker.postMessage(options);
  } catch { fail(); }
}

function toggleAlinMode() {
  if (game.started) return;
  alinMode = !alinMode;
  newGame(game.difficulty);
}

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isFormControl = target instanceof HTMLElement
    && (target.matches("input, textarea, select") || target.isContentEditable);
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.repeat || generatingGame || activeScreen === "island" || isFormControl || showNameSetup || showSaveCenter || showLeaderboard || showBackpack || showAchievements || showAvatarPicker || !game.started || game.completed || game.failed) return;
  if (/^[1-9]$/.test(event.key)) { event.preventDefault(); enterNumber(Number(event.key)); }
  else if (["Backspace", "Delete", "0"].includes(event.key)) { event.preventDefault(); clearCell(); }
  else if (event.key.toLowerCase() === "n") { event.preventDefault(); noteMode = !noteMode; updateBoard({ save: false }); }
  else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    const row = Math.floor(game.selected / 9), col = game.selected % 9;
    const nextRow = Math.max(0, Math.min(8, row + (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0)));
    const nextCol = Math.max(0, Math.min(8, col + (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0)));
    game.selected = nextRow * 9 + nextCol;
    updateBoard({ save: false });
    document.querySelector(`[data-cell="${game.selected}"]`)?.focus({ preventScroll: true });
  }
});

function showStorageWarning() {
  let banner = document.querySelector("#storage-warning");
  const warning = storageWarning();
  if (!warning) { banner?.remove(); return; }
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "storage-warning";
    banner.setAttribute("role", "alert");
    const message = document.createElement("span");
    message.textContent = warning;
    const retry = document.createElement("button");
    retry.textContent = "重試保存";
    retry.addEventListener("click", () => { persistSession(); retryLocalWrites(); });
    banner.append(message, retry);
    document.body.append(banner);
  }
}
window.addEventListener("sudox-storage-status", showStorageWarning);
window.addEventListener("sudox-progress-saved", scheduleCloudSync);
document.addEventListener("pointerdown", resumeAudio, { passive: true });
document.addEventListener("keydown", resumeAudio);
window.addEventListener("pagehide", () => { updateGameClock(); timerWasActive = false; persistSession(); resetGameEffects(); });
window.addEventListener("pageshow", () => { timerLastTick = performance.now(); timerWasActive = gameClockActive(); resumeAudio(); });
showStorageWarning();

if (restoredSession) {
  startTimer();
  if (!progress.playerAvatar) showAvatarPicker = true;
  render();
} else newGame("easy");
if (reconcileActiveSessionFloor()) render();
hydrateCloudProgress().finally(() => reconcileLeaderboardFloorProgress());
if (activeScreen === "island") refreshIslandNetwork();

window.addEventListener("hashchange", () => {
  const nextScreen = location.hash === "#island" ? "island" : "game";
  if (nextScreen === activeScreen) return;
  resetGameEffects();
  activeScreen = nextScreen;
  if (activeScreen === "island") ensureIsland();
  else {
    clearInterval(islandClockId);
    islandClockId = undefined;
  }
  render();
  if (activeScreen === "island") refreshIslandNetwork();
});

document.addEventListener("visibilitychange", () => {
  updateGameClock();
  if (document.visibilityState === "hidden") { persistSession(); resetGameEffects(); }
  else resumeAudio();
  if (document.visibilityState === "visible" && activeScreen === "island") {
    renderIslandView();
    refreshIslandNetwork();
  }
});

window.addEventListener("online", () => {
  flushPendingScores().catch(() => {});
  reconcileLeaderboardFloorProgress();
  syncCloudNow(false);
  if (activeScreen === "island") refreshIslandNetwork();
});
flushPendingScores().catch(() => {});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register(new URL("sw.js?v=v62", document.baseURI), { updateViaCache: "none" }).catch(() => {});
}
