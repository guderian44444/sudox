import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { ISLAND_TEST_MODE } from "../src/island/catalog.js";

const readProjectFile = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
const appSource = readProjectFile("src/app.js");
const indexSource = readProjectFile("index.html");
const serviceWorkerSource = readProjectFile("sw.js");
const handoffSource = readProjectFile("HANDOFF_ISLAND.md");

const appVersion = /const APP_VERSION = "(v\d+)";/.exec(appSource)?.[1] || "";
const updatedAt = /const APP_LAST_UPDATED = "([^"]+)";/.exec(appSource)?.[1] || "";
const cacheVersion = /const CACHE_NAME = "sudox-shell-(v\d+)";/.exec(serviceWorkerSource)?.[1] || "";

assert.equal(ISLAND_TEST_MODE, false, "正式發佈禁止開啟小島測試模式");
assert.match(appVersion, /^v\d+$/, "正式發佈必須提供可見 app 版次");
assert.equal(cacheVersion, appVersion, "Service Worker cache 必須與 app 版次一致");
assert(Number.isFinite(Date.parse(updatedAt)), "APP_LAST_UPDATED 必須是有效 ISO 時間");
const releaseQuery = `?v=${appVersion}`;
assert(indexSource.includes(`./src/app.js${releaseQuery}`), "index.html 必須以版次參數載入 app.js");
assert(indexSource.includes(`./src/styles.css${releaseQuery}`), "index.html 必須以版次參數載入主樣式");
assert(indexSource.includes(`./src/island/island.css${releaseQuery}`), "index.html 必須以版次參數載入小島樣式");
assert(serviceWorkerSource.includes(`const RELEASE_QUERY = "${releaseQuery}";`), "Service Worker 預快取參數必須與 app 版次一致");

const sourceFiles = (directory) => readdirSync(new URL(`../${directory}/`, import.meta.url), { withFileTypes: true }).flatMap((entry) => {
  const relativePath = `${directory}/${entry.name}`;
  return entry.isDirectory() ? sourceFiles(relativePath) : entry.isFile() && entry.name.endsWith(".js") ? [relativePath] : [];
});
for (const relativePath of sourceFiles("src")) {
  const source = readProjectFile(relativePath);
  assert(!/from\s+["']\.\.?\/[^"']+\.js["']/.test(source), `${relativePath} 含未加版次參數的模組 import`);
}
assert(handoffSource.includes(`目前版次：\`${appVersion}\`／Service Worker \`sudox-shell-${appVersion}\``), "Handoff 版次必須與程式一致");
assert(handoffSource.includes("`ISLAND_TEST_MODE` 正式預設為 `false`"), "Handoff 必須記錄正式測試模式狀態");

console.log(`Release gate passed: ${appVersion}, test mode OFF, cache aligned.`);
