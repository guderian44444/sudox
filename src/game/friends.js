/** All selectable / party animals — ids match public/assets/friends/{id}.png */
export const FRIEND_ROSTER = Object.freeze([
  Object.freeze({ id: "cat", name: "貓", face: "•ᴗ•" }),
  Object.freeze({ id: "dog", name: "狗", face: "•ﻌ•" }),
  Object.freeze({ id: "mouse", name: "老鼠", face: "•ﻌ•" }),
  Object.freeze({ id: "hamster", name: "倉鼠", face: "•ω•" }),
  Object.freeze({ id: "rabbit", name: "兔子", face: "•ᴥ•" }),
  Object.freeze({ id: "fox", name: "狐狸", face: "•ᴗ•" }),
  Object.freeze({ id: "bear", name: "熊", face: "ᵔᴥᵔ" }),
  Object.freeze({ id: "panda", name: "熊貓", face: "•ᴗ•" }),
  Object.freeze({ id: "koala", name: "無尾熊", face: "•ᴥ•" }),
  Object.freeze({ id: "tiger", name: "老虎", face: "•ᴗ•" }),
  Object.freeze({ id: "lion", name: "獅子", face: "•ω•" }),
  Object.freeze({ id: "frog", name: "青蛙", face: "•ᴗ•" }),
  Object.freeze({ id: "pig", name: "豬", face: "•ᴥ•" }),
  Object.freeze({ id: "cow", name: "牛", face: "•ᴗ•" }),
  Object.freeze({ id: "monkey", name: "猴子", face: "•ω•" }),
  Object.freeze({ id: "chicken", name: "雞", face: "•ᴗ•" }),
  Object.freeze({ id: "penguin", name: "企鵝", face: "•ᴥ•" }),
  Object.freeze({ id: "whale", name: "鯨魚", face: "•ᴗ•" }),
  Object.freeze({ id: "dolphin", name: "海豚", face: "•ω•" }),
  Object.freeze({ id: "owl", name: "貓頭鷹", face: "•ᴗ•" }),
  Object.freeze({ id: "duck", name: "鴨子", face: "•ᴥ•" }),
  Object.freeze({ id: "horse", name: "馬", face: "•ᴗ•" }),
  Object.freeze({ id: "deer", name: "鹿", face: "•ω•" }),
  Object.freeze({ id: "sheep", name: "羊", face: "•ᴥ•" }),
  Object.freeze({ id: "otter", name: "水獺", face: "ᵔᴥᵔ" })
]);

export const DANCE_VARIANT_COUNT = 4;

export const GARDEN_EEL_VARIANTS = Object.freeze(["orange", "white"]);

export function friendPairKey(friends) {
  return friends.map((friend) => friend.id).sort().join("+");
}

function uniqueRoster(roster) {
  return roster.filter((friend, index) => friend?.id && roster.findIndex((candidate) => candidate?.id === friend.id) === index);
}

export function chooseFriendPair(previousKey = "", random = Math.random, roster = FRIEND_ROSTER) {
  const friends = uniqueRoster(roster);
  if (friends.length < 2) return { friends, key: friendPairKey(friends) };

  const pairs = [];
  for (let left = 0; left < friends.length - 1; left += 1) {
    for (let right = left + 1; right < friends.length; right += 1) pairs.push([friends[left], friends[right]]);
  }
  const alternatives = pairs.filter((pair) => friendPairKey(pair) !== previousKey);
  const pool = alternatives.length ? alternatives : pairs;
  const roll = Math.max(0, Math.min(0.999999, Number(random()) || 0));
  const selected = [...pool[Math.floor(roll * pool.length)]];
  if ((Number(random()) || 0) >= 0.5) selected.reverse();
  return { friends: selected, key: friendPairKey(selected) };
}

/**
 * Cycle dance variants 1..4 for a pair so every event uses different moves.
 * @param {number} cursor zero-based counter (mutated externally by caller)
 * @returns {{ left: number, right: number, nextCursor: number }}
 */
export function nextDanceVariants(cursor = 0) {
  const start = Math.max(0, Math.floor(Number(cursor) || 0));
  const left = (start % DANCE_VARIANT_COUNT) + 1;
  const right = ((start + 1) % DANCE_VARIANT_COUNT) + 1;
  return { left, right, nextCursor: start + 1 };
}

/**
 * Finale party: player animal + N other random guests.
 * @param {string} [playerId]
 * @param {number} [guestCount]
 * @param {() => number} [random]
 * @param {readonly {id:string,name:string,face?:string}[]} [roster]
 */
export function choosePartyFriends(playerId = "", guestCount = 5, random = Math.random, roster = FRIEND_ROSTER) {
  const friends = uniqueRoster(roster);
  const player = friends.find((friend) => friend.id === playerId) || null;
  const pool = friends.filter((friend) => friend.id !== player?.id);
  const shuffled = [...pool];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const roll = Math.max(0, Math.min(0.999999, Number(random()) || 0));
    const swap = Math.floor(roll * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  const guests = shuffled.slice(0, Math.max(0, Math.min(guestCount, shuffled.length)));
  // Player leads the line when present; otherwise fill with guests only.
  return player ? [player, ...guests] : guests;
}

/**
 * Pick a garden-eel peek cell.
 * Prefer empty board cells so the eel does not cover filled numbers.
 * @param {() => number} [random]
 * @param {number | { cellCount?: number, emptyCells?: number[] }} [cellCountOrOptions]
 * @returns {{ cell: number, variant: string } | null}
 */
export function chooseGardenEel(random = Math.random, cellCountOrOptions = 81) {
  const roll = () => Math.max(0, Math.min(0.999999, Number(random()) || 0));
  const options = typeof cellCountOrOptions === "object" && cellCountOrOptions
    ? cellCountOrOptions
    : { cellCount: cellCountOrOptions };
  const cellCount = Math.max(1, Math.floor(Number(options.cellCount) || 81));
  let pool;
  if (Array.isArray(options.emptyCells)) {
    pool = options.emptyCells.filter((cell) => Number.isInteger(cell) && cell >= 0 && cell < cellCount);
    if (!pool.length) return null;
  } else {
    pool = Array.from({ length: cellCount }, (_, cell) => cell);
  }
  return {
    cell: pool[Math.floor(roll() * pool.length)],
    variant: GARDEN_EEL_VARIANTS[Math.floor(roll() * GARDEN_EEL_VARIANTS.length)]
  };
}
