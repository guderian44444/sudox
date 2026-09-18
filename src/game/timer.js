// Count elapsed foreground time, including delayed timer callbacks, without drift.
export function advanceGameClock(game, milliseconds) {
  if (!game?.started || game.completed || game.failed || !Number.isFinite(milliseconds) || milliseconds < 0) return;
  const total = (game.clockRemainderMs || 0) + milliseconds;
  const seconds = Math.floor(total / 1000);
  game.clockRemainderMs = total % 1000;
  const frozen = Math.min(game.frozenSeconds || 0, seconds);
  game.frozenSeconds = (game.frozenSeconds || 0) - frozen;
  game.elapsed += seconds - frozen;
}
