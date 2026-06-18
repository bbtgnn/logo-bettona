// Fake "music" for the Demo source: a 2 Hz kick (bass + a mid thud) and an
// offbeat hat (treble), each a sharp attack with exponential decay — NOT a
// smooth sine — so the audio-zones snap is visible without loading a file.

const KICK_PERIOD_MS = 500; // 2 Hz
const DECAY_MS = 90; // pulse e-folding time; smaller = snappier

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

// Pulse that hits 1 at phase 0 and decays exponentially over the period.
function pulse(nowMs: number, periodMs: number, offsetMs: number, decayMs: number): number {
  const phase = (((nowMs - offsetMs) % periodMs) + periodMs) % periodMs;
  return Math.exp(-phase / decayMs);
}

export function demoZones(nowMs: number): { bass: number; mid: number; treble: number } {
  const kick = pulse(nowMs, KICK_PERIOD_MS, 0, DECAY_MS);
  const hat = pulse(nowMs, KICK_PERIOD_MS, KICK_PERIOD_MS / 2, DECAY_MS * 0.7);
  return {
    bass: clamp01(kick),
    mid: clamp01(kick * 0.6 + hat * 0.2),
    treble: clamp01(hat)
  };
}
