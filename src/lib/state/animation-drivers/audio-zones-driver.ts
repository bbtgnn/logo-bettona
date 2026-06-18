import type { Ring, ZoneIntensity, ZoneDrive, EnvelopeParams } from '$lib/types';
import { resolveZoneIntensity } from '$lib/geometry/zones';

const VIBR_FREQ = 8; // Hz — treble tangential vibration frequency (fixed)

// Per-band threshold→expand response curve, ported from the old p5 sketch
// (0–255 thresholds bass 60 / mid 50 / treble 70, saturation 220, ÷255).
// Below floor → 0 (still petals); above sat → 1 (snap).
const RESPONSE = {
  bass: { floor: 0.235, sat: 0.863 },
  mid: { floor: 0.196, sat: 0.863 },
  treble: { floor: 0.275, sat: 0.863 }
} as const;

function respond(raw: number, floor: number, sat: number): number {
  if (sat <= floor) return 0;
  return clamp01((raw - floor) / (sat - floor));
}

type AnimationDriver = {
  init: () => void;
  dispose: () => void;
  frame: (nowMs: number) => Record<number, number>;
};

type Envelopes = { bass: EnvelopeParams; mid: EnvelopeParams; treble: EnvelopeParams };

type CreateAudioZonesDriverDeps = {
  getDefaultIntensity: () => ZoneIntensity;
  getRingCount: () => number;
  getRing: (index: number) => Ring;
  readZones: () => { bass: number; mid: number; treble: number };
  getEnvelopes: () => Envelopes;
  applyRingZoneDrive: (index: number, drive: ZoneDrive | null) => void;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalizeRingCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isInteger(value)) return Math.max(0, Math.floor(value));
  return Math.max(0, value);
}

// Asymmetric per-frame smoothing: rising input uses attack, falling uses release.
// Per-frame (no dt) — assumes steady ~60fps rAF, matching the source sketch's fixed-rate lerp.
function envelope(prev: number, raw: number, env: EnvelopeParams): number {
  const rate = raw > prev ? env.attack : env.release;
  return prev + (raw - prev) * rate;
}

export function createAudioZonesDriver(deps: CreateAudioZonesDriverDeps): AnimationDriver {
  let smoothed = { bass: 0, mid: 0, treble: 0 };

  return {
    init() {
      smoothed = { bass: 0, mid: 0, treble: 0 };
      deps.getDefaultIntensity();
    },

    dispose() {
      const ringCount = normalizeRingCount(deps.getRingCount());
      for (let i = 0; i < ringCount; i++) {
        deps.applyRingZoneDrive(i, null);
      }
    },

    frame(nowMs) {
      const raw = deps.readZones();
      const env = deps.getEnvelopes();
      const responded = {
        bass: respond(clamp01(raw.bass), RESPONSE.bass.floor, RESPONSE.bass.sat),
        mid: respond(clamp01(raw.mid), RESPONSE.mid.floor, RESPONSE.mid.sat),
        treble: respond(clamp01(raw.treble), RESPONSE.treble.floor, RESPONSE.treble.sat)
      };
      smoothed = {
        bass: envelope(smoothed.bass, responded.bass, env.bass),
        mid: envelope(smoothed.mid, responded.mid, env.mid),
        treble: envelope(smoothed.treble, responded.treble, env.treble)
      };

      const defaultIntensity = deps.getDefaultIntensity();
      const ringCount = normalizeRingCount(deps.getRingCount());
      const nowSec = (Number.isFinite(nowMs) ? nowMs : 0) / 1000;
      const vibratePhase = Math.sin(2 * Math.PI * VIBR_FREQ * nowSec);

      for (let i = 0; i < ringCount; i++) {
        const ring = deps.getRing(i);
        const cfg = resolveZoneIntensity(ring, defaultIntensity);
        const trebleNorm = smoothed.treble * cfg.treble;
        deps.applyRingZoneDrive(i, {
          bassPush: smoothed.bass * cfg.bass,
          midPush: smoothed.mid * cfg.mid,
          trebleRetract: trebleNorm,
          trebleVibrate: trebleNorm * vibratePhase
        });
      }

      return {};
    }
  };
}
