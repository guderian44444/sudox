const CACHE_NAME = "sudox-shell-v49";
const BASE_PATH = new URL("./", self.location.href).pathname;
const RELEASE_QUERY = "?v=v49";
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
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match(`${BASE_PATH}index.html`)))
  );
});
