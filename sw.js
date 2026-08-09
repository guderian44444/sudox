const CACHE_NAME = "sudox-shell-v39";
const BASE_PATH = new URL("./", self.location.href).pathname;
const APP_SHELL = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}src/app.js`,
  `${BASE_PATH}src/config.js`,
  `${BASE_PATH}src/styles.css`,
  `${BASE_PATH}src/island/island.css`,
  `${BASE_PATH}src/island/assets.js`,
  `${BASE_PATH}src/island/catalog.js`,
  `${BASE_PATH}src/island/hex.js`,
  `${BASE_PATH}src/island/model.js`,
  `${BASE_PATH}src/island/renderer.js`,
  `${BASE_PATH}src/game/sudoku.js`,
  `${BASE_PATH}src/game/adventure.js`,
  `${BASE_PATH}src/game/flow.js`,
  `${BASE_PATH}src/game/achievements.js`,
  `${BASE_PATH}src/game/friends.js`,
  `${BASE_PATH}src/state/store.js`,
  `${BASE_PATH}src/state/cloud.js`,
  `${BASE_PATH}src/state/leaderboard.js`,
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
