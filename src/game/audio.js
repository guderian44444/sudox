const sounds = {
    toggle: [[660, 0, .08], [880, .08, .1]],
    correct: [[620, 0, .055]],
    success: [[523, 0, .1], [659, .09, .1], [784, .18, .13]],
    "row-0": [[523, 0, .08], [659, .1, .08], [784, .2, .12]],
    "row-1": [[784, 0, .08], [659, .1, .08], [880, .2, .12]],
    "column-0": [[440, 0, .08], [587, .09, .08], [880, .18, .14]],
    "column-1": [[880, 0, .08], [587, .1, .08], [698, .2, .13]],
    "box-0": [[523, 0, .07], [659, .08, .07], [784, .16, .07], [1047, .24, .14]],
    "box-1": [[784, 0, .07], [988, .08, .07], [659, .16, .07], [880, .24, .14]],
    mistake: [[330, 0, .11], [247, .1, .18]],
    failure: [[392, 0, .1], [294, .11, .12], [196, .24, .24]],
    revive: [[330, 0, .08], [494, .09, .08], [659, .18, .1], [988, .3, .2]],
    shield: [[740, 0, .06], [1110, .07, .16]],
    card: [[392, 0, .07], [523, .07, .07], [784, .14, .16]],
    "finale-0": [[523, 0, .11], [659, .11, .11], [784, .22, .12], [1047, .36, .3]],
    "finale-1": [[659, 0, .1], [784, .1, .1], [988, .2, .14], [784, .35, .1], [1175, .47, .28]],
    "finale-2": [[392, 0, .1], [523, .1, .1], [659, .2, .1], [784, .3, .1], [1047, .43, .32]]
};

let audioContext = null;
let enabled = true;
let resumePending = null;
let requestId = 0;
const nodes = new Set();

export function setSoundEnabled(value) {
  enabled = Boolean(value);
  if (!enabled) stopAudio();
}

export function stopAudio() {
  requestId++;
  for (const oscillator of nodes) { try { oscillator.stop(); } catch { /* already ended */ } }
  nodes.clear();
}

export function resumeAudio() {
  if (!enabled) return Promise.resolve(false);
  try {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return Promise.resolve(false);
    if (!audioContext || audioContext.state === "closed") audioContext = new Context();
    const context = audioContext;
    if (context.state === "running") return Promise.resolve(true);
    if (resumePending) return resumePending;
    // Safari can enter "interrupted" after lock screen, a call, or an app switch.
    // Initiate resume synchronously inside the user gesture, before any await.
    let timeout;
    resumePending = Promise.race([
      context.resume().then(() => context.state === "running"),
      new Promise((resolve) => { timeout = setTimeout(() => resolve(false), 1200); })
    ]).catch(() => false).then((running) => {
      if (!running && audioContext === context) {
        context.close().catch(() => {});
        audioContext = null;
      }
      return running;
    }).finally(() => { clearTimeout(timeout); resumePending = null; });
    return resumePending;
  } catch { audioContext = null; return Promise.resolve(false); }
}

export function playSound(name) {
  if (!enabled) return;
  const id = ++requestId;
  const requestedAt = performance.now();
  const play = () => {
    if (!enabled || id !== requestId || performance.now() - requestedAt > 500 || audioContext?.state !== "running") return;
    try {
      const sequence = sounds[name] || sounds.success;
      const start = audioContext.currentTime;
      sequence.forEach(([frequency, delay, duration], index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = index % 2 ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, start + delay);
        gain.gain.setValueAtTime(.0001, start + delay);
        gain.gain.exponentialRampToValueAtTime(.055, start + delay + .018);
        gain.gain.exponentialRampToValueAtTime(.0001, start + delay + duration);
        oscillator.connect(gain).connect(audioContext.destination);
        nodes.add(oscillator);
        oscillator.onended = () => { nodes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start + delay);
        oscillator.stop(start + delay + duration + .02);
      });
    } catch { stopAudio(); /* An audio failure must never abort a game action. */ }
  };
  if (audioContext?.state === "running") play();
  else resumeAudio().then(play).catch(() => {});
}
