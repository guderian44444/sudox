const CACHE_NAME = "sudox-shell-v62";
const BASE_PATH = new URL("./", self.location.href).pathname;
const RELEASE_QUERY = "?v=v62";
const APP_SHELL = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}src/app.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/config.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/styles.css${RELEASE_QUERY}`,
  `${BASE_PATH}src/island/island.css${RELEASE_QUERY}`,
  `${BASE_PATH}src/island/assets.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/island/attractions.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/island/catalog.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/island/companions.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/island/hex.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/island/logistics.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/island/model.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/island/renderer.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/game/sudoku.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/game/puzzle-worker.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/game/audio.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/game/timer.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/state/storage.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/game/adventure.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/game/flow.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/game/achievements.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/game/friends.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/state/store.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/state/cloud.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/state/island-cloud.js${RELEASE_QUERY}`,
  `${BASE_PATH}src/state/leaderboard.js${RELEASE_QUERY}`,
  `${BASE_PATH}manifest.webmanifest`,
  `${BASE_PATH}assets/app-icon.svg`,
  `${BASE_PATH}public/assets/eel-orange.webp`,
  `${BASE_PATH}public/assets/eel-white.webp`
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("sudox-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE_PATH)) return;
  // Animation frame restart parameters must not create unlimited duplicate cache entries.
  url.searchParams.delete("t");
  const key = url.href;
  const versioned = url.searchParams.get("v") === RELEASE_QUERY.slice(3);
  const asset = url.pathname.startsWith(`${BASE_PATH}public/assets/`) || url.pathname.startsWith(`${BASE_PATH}assets/`);
  if (request.mode !== "navigate" && !versioned && !asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(key);
    if (request.mode !== "navigate" && cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== "opaque") {
        event.waitUntil(cache.put(key, response.clone()).catch(() => {}));
      }
      return response;
    } catch {
      if (cached) return cached;
      if (request.mode === "navigate") {
        const shell = await cache.match(`${BASE_PATH}index.html`);
        if (shell) return shell;
      }
      return Response.error();
    }
  })());
});
