import type { Ring, ZoneIntensity, ZoneDrive, EnvelopeParams } from '$lib/types';
import { resolveZoneIntensity, ZONE_SCALE } from '$lib/geometry/zones';

const VIBR_FREQ = 8; // Hz — treble tangential vibration frequency (fixed)
const VIBR_AMT = 0.5; // fraction of treble push expressed as vibration amplitude

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
      smoothed = {
        bass: envelope(smoothed.bass, clamp01(raw.bass), env.bass),
        mid: envelope(smoothed.mid, clamp01(raw.mid), env.mid),
        treble: envelope(smoothed.treble, clamp01(raw.treble), env.treble)
      };

      const defaultIntensity = deps.getDefaultIntensity();
      const ringCount = normalizeRingCount(deps.getRingCount());
      const nowSec = (Number.isFinite(nowMs) ? nowMs : 0) / 1000;
      const vibratePhase = Math.sin(2 * Math.PI * VIBR_FREQ * nowSec);

      for (let i = 0; i < ringCount; i++) {
        const ring = deps.getRing(i);
        const cfg = resolveZoneIntensity(ring, defaultIntensity);
        const trebleBase = smoothed.treble * cfg.treble * ZONE_SCALE;
        deps.applyRingZoneDrive(i, {
          bassPush: smoothed.bass * cfg.bass * ZONE_SCALE,
          midPush: smoothed.mid * cfg.mid * ZONE_SCALE,
          trebleRetract: trebleBase,
          trebleVibrate: trebleBase * VIBR_AMT * vibratePhase
        });
      }

      return {};
    }
  };
}
