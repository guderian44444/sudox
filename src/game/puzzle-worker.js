import { createAdventureGame } from "./flow.js?v=v63";

self.onmessage = ({ data }) => {
  try { self.postMessage({ game: createAdventureGame(data) }); }
  catch (error) { self.postMessage({ error: error.message || "出題失敗，請重試" }); }
};
