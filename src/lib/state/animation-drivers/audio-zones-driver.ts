import type { Ring, ZoneIntensity, ZoneDrive, EnvelopeParams } from '$lib/types';
import { resolveZoneIntensity } from '$lib/geometry/zones';

// Per-band threshold→expand response curve, ported from the old p5 sketch
// Below floor → 0 (still in silence); above sat → 1 (full effect). Lower floor =
// reacts to quieter sound; lower sat = reaches full effect sooner. Widened from the
// old p5 thresholds to make all three bands more sensitive without raising the max
// reach (so nothing clips the edge). Exported as the single source of truth (the spec
// imports it) so this can be tuned without churning test literals.
export const RESPONSE = {
  bass: { floor: 0.15, sat: 0.65 },
  mid: { floor: 0.12, sat: 0.65 },
  treble: { floor: 0.18, sat: 0.65 }
} as const;

function respond(raw: number, floor: number, sat: number): number {
  if (sat <= floor) return 0;
  return clamp01((raw - floor) / (sat - floor));
}

// Per-band asymmetric attack/release (applied per rAF frame at ~60fps).
// Goal is the old repo's "breathing flower": a SMOOTH organic swell-and-settle, not
// a hard snap. The old p5 sketch ran at 30fps with attack/release 0.35/0.18 (bass),
// 0.5/0.25 (mid), 0.8/0.5 (treble). We tick at ~60fps, so per-frame rates are
// dt-corrected (r60 = 1 - sqrt(1 - r30)) to reproduce the same time response.
// Exported so the spec verifies the mechanic against the live values (no magic literals).
export const ENVELOPE = {
  bass: { attack: 0.2, release: 0.1 },
  mid: { attack: 0.3, release: 0.13 },
  treble: { attack: 0.55, release: 0.3 }
} as const;

type AnimationDriver = {
  init: () => void;
  dispose: () => void;
  frame: (nowMs: number) => Record<number, number>;
};

type CreateAudioZonesDriverDeps = {
  getDefaultIntensity: () => ZoneIntensity;
  getRingCount: () => number;
  getRing: (index: number) => Ring;
  readZones: () => { bass: number; mid: number; treble: number };
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
      const responded = {
        bass: respond(clamp01(raw.bass), RESPONSE.bass.floor, RESPONSE.bass.sat),
        mid: respond(clamp01(raw.mid), RESPONSE.mid.floor, RESPONSE.mid.sat),
        treble: respond(clamp01(raw.treble), RESPONSE.treble.floor, RESPONSE.treble.sat)
      };
      smoothed = {
        bass: envelope(smoothed.bass, responded.bass, ENVELOPE.bass),
        mid: envelope(smoothed.mid, responded.mid, ENVELOPE.mid),
        treble: envelope(smoothed.treble, responded.treble, ENVELOPE.treble)
      };

      const defaultIntensity = deps.getDefaultIntensity();
      const ringCount = normalizeRingCount(deps.getRingCount());

      for (let i = 0; i < ringCount; i++) {
        const ring = deps.getRing(i);
        const cfg = resolveZoneIntensity(ring, defaultIntensity);
        const trebleNorm = smoothed.treble * cfg.treble;
        // No 8Hz oscillator (that read as a "panic attack" jitter and is absent from
        // the old sketch). Treble is a smooth magnitude: inner tip retracts inward and
        // leans tangentially, both growing/settling with the envelope. Breathing, not jitter.
        deps.applyRingZoneDrive(i, {
          bassPush: smoothed.bass * cfg.bass,
          midPush: smoothed.mid * cfg.mid,
          trebleRetract: trebleNorm,
          trebleVibrate: trebleNorm
        });
      }

      return {};
    }
  };
}
