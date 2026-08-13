import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FRIEND_ROSTER, DANCE_VARIANT_COUNT } from "../src/game/friends.js";
import { ISLAND_ASSET_MANIFEST } from "../src/island/assets.js";
import { BUILDING_CATALOG, HOME_LEVELS, ITEM_CATALOG } from "../src/island/catalog.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const islandAssetRoot = path.join(projectRoot, "public", "assets", "island", "v1");
const publicAssetRoot = path.join(projectRoot, "public", "assets");
const argumentsSet = new Set(process.argv.slice(2));
const listAssets = argumentsSet.has("--list");
const requireFiles = argumentsSet.has("--require-files");

const constructionEntries = ["building", "reclaim", "homeUpgrade", "demolition"].map((id) => ({
  kind: "active construction",
  id,
  key: `construction/${id}`,
  fallback: true
}));

const terrainEntries = ["water", "reclaimable", "grass", "reclaimed"].map((id) => ({
  kind: "active terrain",
  id,
  key: `terrain/${id}`,
  fallback: true
}));

const entries = [
  ...Object.values(BUILDING_CATALOG).map((building) => ({
    kind: "active building",
    id: building.id,
    key: building.assetKey,
    fallback: Boolean(building.icon)
  })),
  ...HOME_LEVELS.map((level) => ({
    kind: "active home level",
    id: `home-level-${level.level}`,
    key: level.assetKey,
    fallback: Boolean(level.icon)
  })),
  ...constructionEntries,
  ...terrainEntries,
  ...Object.values(ITEM_CATALOG).map((item) => ({
    kind: "reserved item",
    id: item.id,
    key: item.assetKey,
    fallback: Boolean(item.icon)
  }))
];

const uniqueEntries = [];
const seenEntries = new Set();
for (const entry of entries) {
  const identity = entry.key;
  if (seenEntries.has(identity)) continue;
  seenEntries.add(identity);
  uniqueEntries.push(entry);
}

const problems = [];
const warnings = [];
const keyPattern = /^(?:(?:buildings|items|terrain)\/[a-z0-9]+(?:-[a-z0-9]+)*|construction\/(?:building|reclaim|homeUpgrade|demolition))$/;
for (const entry of uniqueEntries) {
  if (!entry.key || !keyPattern.test(entry.key)) problems.push(`${entry.kind} ${entry.id} 的 assetKey 不合法：${entry.key || "<empty>"}`);
  if (!entry.fallback) problems.push(`${entry.kind} ${entry.id} 缺少 emoji fallback`);
}

const expectedKeys = new Set(uniqueEntries.map((entry) => entry.key));
const manifestPaths = new Map();
for (const [assetKey, relativePath] of Object.entries(ISLAND_ASSET_MANIFEST)) {
  if (!expectedKeys.has(assetKey)) warnings.push(`manifest key 尚未被目前 catalog／renderer 使用：${assetKey}`);
  if (typeof relativePath !== "string" || !relativePath.trim()) {
    problems.push(`manifest ${assetKey} 的路徑不是有效字串`);
    continue;
  }
  const normalizedPath = relativePath.replaceAll("\\", "/");
  if (path.isAbsolute(relativePath) || normalizedPath.startsWith("../") || normalizedPath.includes("/../")) {
    problems.push(`manifest ${assetKey} 不可離開 public/assets/island/v1：${relativePath}`);
    continue;
  }
  if (!/^[a-z0-9][a-z0-9/.-]*\.(webp|png|svg)$/.test(normalizedPath)) {
    problems.push(`manifest ${assetKey} 路徑需為小寫 kebab-case WebP／PNG／SVG：${relativePath}`);
  }
  if (manifestPaths.has(normalizedPath)) {
    problems.push(`manifest 路徑重複：${relativePath} 同時給 ${manifestPaths.get(normalizedPath)} 與 ${assetKey}`);
  }
  manifestPaths.set(normalizedPath, assetKey);
  if (!existsSync(path.join(islandAssetRoot, ...normalizedPath.split("/")))) {
    problems.push(`manifest ${assetKey} 指向不存在的檔案：${relativePath}`);
    continue;
  }
  const metadataPath = path.join(islandAssetRoot, ...normalizedPath.replace(/\.[^.]+$/, ".json").split("/"));
  if (!existsSync(metadataPath)) {
    problems.push(`manifest ${assetKey} 缺少同名 sidecar JSON：${path.relative(islandAssetRoot, metadataPath)}`);
    continue;
  }
  try {
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
    const requiredFields = ["styleId", "assetId", "sourceKey", "width", "height", "frames", "fps", "anchor", "prompt", "negativePrompt", "generatedAt"];
    const missingFields = requiredFields.filter((field) => metadata[field] === undefined || metadata[field] === "");
    if (metadata.styleId !== "SUDOX Buddy & Island Style v1") missingFields.push("styleId=SUDOX Buddy & Island Style v1");
    if (metadata.sourceKey !== assetKey) missingFields.push(`sourceKey=${assetKey}`);
    if (!(Number(metadata.width) > 0) || !(Number(metadata.height) > 0)) missingFields.push("positive width/height");
    if (!(Number(metadata.frames) >= 1) || !(Number(metadata.fps) >= 0)) missingFields.push("valid frames/fps");
    if (!Number.isFinite(Number(metadata.anchor?.x)) || !Number.isFinite(Number(metadata.anchor?.y))) missingFields.push("anchor.x/anchor.y");
    if (missingFields.length) problems.push(`sidecar ${path.relative(islandAssetRoot, metadataPath)} 缺少／不符：${missingFields.join(", ")}`);
  } catch (error) {
    problems.push(`sidecar ${path.relative(islandAssetRoot, metadataPath)} 不是有效 JSON：${error.message}`);
  }
}

const missingManifestKeys = uniqueEntries.filter((entry) => !ISLAND_ASSET_MANIFEST[entry.key]);
if (requireFiles && missingManifestKeys.length) {
  problems.push(`--require-files：仍有 ${missingManifestKeys.length} 個 catalog／施工 key 未登錄正式檔案`);
}

let directFriendFileCount = 0;
for (const friend of FRIEND_ROSTER) {
  const directFiles = [
    path.join(publicAssetRoot, "friends", `${friend.id}.png`),
    path.join(publicAssetRoot, "friends-faint", `${friend.id}.webp`),
    ...Array.from({ length: DANCE_VARIANT_COUNT }, (_, index) => path.join(publicAssetRoot, "friends-dance", `${friend.id}_${index + 1}.webp`))
  ];
  for (const filePath of directFiles) {
    if (!existsSync(filePath)) problems.push(`伙伴直接素材不存在：${path.relative(projectRoot, filePath)}`);
    else directFriendFileCount += 1;
  }
}

if (listAssets) {
  console.log("status\tkind\tid\tassetKey\tfile");
  for (const entry of uniqueEntries.sort((left, right) => left.key.localeCompare(right.key))) {
    const relativePath = ISLAND_ASSET_MANIFEST[entry.key] || "";
    console.log(`${relativePath ? "file" : "fallback"}\t${entry.kind}\t${entry.id}\t${entry.key}\t${relativePath || "-"}`);
  }
}

const activeKeys = new Set(uniqueEntries.filter((entry) => entry.kind.startsWith("active")).map((entry) => entry.key));
const reservedKeys = new Set(uniqueEntries.filter((entry) => entry.kind.startsWith("reserved")).map((entry) => entry.key));
const activeFiles = [...activeKeys].filter((key) => ISLAND_ASSET_MANIFEST[key]).length;
const reservedFiles = [...reservedKeys].filter((key) => ISLAND_ASSET_MANIFEST[key]).length;

console.log(`小島素材稽核：${activeKeys.size} 個已接通 key（${activeFiles} 正式檔／${activeKeys.size - activeFiles} fallback），${reservedKeys.size} 個產品預留 key（${reservedFiles} 正式檔），${directFriendFileCount} 個伙伴直接素材。`);
for (const warning of warnings) console.warn(`WARN ${warning}`);
if (problems.length) {
  for (const problem of problems) console.error(`ERROR ${problem}`);
  process.exitCode = 1;
} else {
  console.log(requireFiles ? "小島素材完整檔案 gate 通過。" : "小島素材結構與 fallback gate 通過。");
}
