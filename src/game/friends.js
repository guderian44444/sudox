export const FRIEND_ROSTER = Object.freeze([
  Object.freeze({ id: "cat", name: "貓咪", face: "•ᴗ•" }),
  Object.freeze({ id: "mouse", name: "老鼠", face: "•ﻌ•" }),
  Object.freeze({ id: "otter", name: "水獺", face: "ᵔᴥᵔ" })
]);

export const GARDEN_EEL_VARIANTS = Object.freeze(["orange", "white"]);

export function friendPairKey(friends) {
  return friends.map((friend) => friend.id).sort().join("+");
}

export function chooseFriendPair(previousKey = "", random = Math.random, roster = FRIEND_ROSTER) {
  const friends = roster.filter((friend, index) => friend?.id && roster.findIndex((candidate) => candidate?.id === friend.id) === index);
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

export function chooseGardenEel(random = Math.random, cellCount = 81) {
  const roll = () => Math.max(0, Math.min(0.999999, Number(random()) || 0));
  return {
    cell: Math.floor(roll() * cellCount),
    variant: GARDEN_EEL_VARIANTS[Math.floor(roll() * GARDEN_EEL_VARIANTS.length)]
  };
}
