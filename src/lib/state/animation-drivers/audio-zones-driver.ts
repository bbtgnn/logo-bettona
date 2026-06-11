import type { Ring, ZoneIntensity, ZoneDrive } from '$lib/types';
import { resolveZoneIntensity, ZONE_SCALE } from '$lib/geometry/zones';

const SHIMMER_FREQ = 8; // Hz — treble bobbing frequency; promote to slider if needed

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

export function createAudioZonesDriver(deps: CreateAudioZonesDriverDeps): AnimationDriver {
  return {
    init() {
      deps.getDefaultIntensity();
    },

    dispose() {
      const ringCount = normalizeRingCount(deps.getRingCount());
      for (let i = 0; i < ringCount; i++) {
        deps.applyRingZoneDrive(i, null);
      }
    },

    frame(nowMs) {
      const { bass, mid, treble } = deps.readZones();
      const defaultIntensity = deps.getDefaultIntensity();
      const ringCount = normalizeRingCount(deps.getRingCount());
      const nowSec = (Number.isFinite(nowMs) ? nowMs : 0) / 1000;
      const shimmer = Math.sin(2 * Math.PI * SHIMMER_FREQ * nowSec);

      for (let i = 0; i < ringCount; i++) {
        const ring = deps.getRing(i);
        const cfg = resolveZoneIntensity(ring, defaultIntensity);
        deps.applyRingZoneDrive(i, {
          bassPush:   clamp01(bass)   * cfg.bass   * ZONE_SCALE,
          midPush:    clamp01(mid)    * cfg.mid    * ZONE_SCALE,
          treblePush: clamp01(treble) * cfg.treble * ZONE_SCALE * shimmer
        });
      }

      return {};
    }
  };
}
