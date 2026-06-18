import { describe, expect, it } from 'vitest';
import type { Ring, ZoneIntensity, ZoneDrive } from '$lib/types';
import { createAudioZonesDriver } from './audio-zones-driver';

const defaultIntensity: ZoneIntensity = { bass: 0.5, mid: 0.5, treble: 0.5 };

// Mirror of the driver's per-band threshold→expand response curve, for expectations.
const RESP = {
  bass: { floor: 0.235, sat: 0.863 },
  mid: { floor: 0.196, sat: 0.863 },
  treble: { floor: 0.275, sat: 0.863 }
};
// Mirror of the driver's baked per-band attack/release envelope (old p5 sketch values).
const ENVELOPE = {
  bass: { attack: 0.35, release: 0.18 },
  mid: { attack: 0.5, release: 0.25 },
  treble: { attack: 0.8, release: 0.5 }
};
function respondExpect(raw: number, floor: number, sat: number): number {
  if (sat <= floor) return 0;
  return Math.max(0, Math.min(1, (raw - floor) / (sat - floor)));
}

type DriveCall = { index: number; drive: ZoneDrive | null };

function makeRing(zoneConfig?: ZoneIntensity | null): Ring {
  return {
    copies: 8,
    color: '#000000',
    templatePath: null,
    secondaryTemplatePath: null,
    morphT: 0,
    ringHeight: 0.4,
    zoneConfig
  };
}

function makeDriver(overrides: {
  ringCount?: number;
  zones?: { bass: number; mid: number; treble: number };
  calls: DriveCall[];
  rings?: Ring[];
}) {
  const rings = overrides.rings ?? [];
  return createAudioZonesDriver({
    getDefaultIntensity: () => defaultIntensity,
    getRingCount: () => overrides.ringCount ?? 2,
    getRing: (i) => rings[i] ?? makeRing(),
    readZones: () => overrides.zones ?? { bass: 0.5, mid: 0.8, treble: 0.3 },
    applyRingZoneDrive: (index, drive) => overrides.calls.push({ index, drive })
  });
}

describe('createAudioZonesDriver', () => {
  it('frame() writes zoneDrive for every ring', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 2, calls });
    driver.init();
    driver.frame(0);
    expect(calls).toHaveLength(2);
    expect(calls[0].index).toBe(0);
    expect(calls[1].index).toBe(1);
    expect(calls[0].drive).not.toBeNull();
    expect(calls[1].drive).not.toBeNull();
  });

  it('frame() emits bassPush = respond(raw) * bass attack * intensity (first frame)', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0.5, mid: 0, treble: 0 }, calls });
    driver.init();
    driver.frame(0);
    const expected =
      respondExpect(0.5, RESP.bass.floor, RESP.bass.sat) * ENVELOPE.bass.attack * defaultIntensity.bass;
    expect(calls[0].drive?.bassPush).toBeCloseTo(expected, 6);
  });

  it('frame() emits midPush = respond(raw) * mid attack * intensity (first frame)', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0.8, treble: 0 }, calls });
    driver.init();
    driver.frame(0);
    const expected =
      respondExpect(0.8, RESP.mid.floor, RESP.mid.sat) * ENVELOPE.mid.attack * defaultIntensity.mid;
    expect(calls[0].drive?.midPush).toBeCloseTo(expected, 6);
  });

  it('frame() floors a sub-threshold band to zero deformation', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0.1, mid: 0.1, treble: 0.1 }, calls });
    driver.init();
    driver.frame(0);
    expect(calls[0].drive?.bassPush).toBe(0);
    expect(calls[0].drive?.midPush).toBe(0);
    expect(calls[0].drive?.trebleRetract).toBe(0);
    expect(calls[0].drive?.trebleVibrate).toBe(0);
  });

  it('sustained above-sat input converges toward intensity (respond saturates to 1)', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 1.0, mid: 0, treble: 0 }, calls });
    driver.init();
    for (let i = 0; i < 60; i++) driver.frame(i * 16);
    // respond(1)=1; smoothed converges to 1 under repeated attack → bassPush → intensity.
    expect(calls[calls.length - 1].drive?.bassPush).toBeCloseTo(defaultIntensity.bass, 4);
  });

  it('frame() keeps all normalized fields within range under full input', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 1.0, mid: 1.0, treble: 1.0 }, calls });
    driver.init();
    driver.frame(31.25); // phase = +1
    const d = calls[0].drive!;
    expect(d.bassPush).toBeGreaterThanOrEqual(0);
    expect(d.bassPush).toBeLessThanOrEqual(1);
    expect(d.midPush).toBeLessThanOrEqual(1);
    expect(d.trebleRetract).toBeLessThanOrEqual(1);
    expect(Math.abs(d.trebleVibrate)).toBeLessThanOrEqual(1);
  });

  it('attack uses the baked bass attack (0.35) on rising input', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 1, mid: 0, treble: 0 }, calls }); // respond(1)=1
    driver.init();
    driver.frame(0); // smoothed = 0 + (1-0)*0.35 = 0.35
    expect(calls[0].drive?.bassPush).toBeCloseTo(0.35 * defaultIntensity.bass, 6);
    driver.frame(16); // smoothed = 0.35 + (1-0.35)*0.35 = 0.5775
    expect(calls[1].drive?.bassPush).toBeCloseTo((0.35 + (1 - 0.35) * 0.35) * defaultIntensity.bass, 6);
  });

  it('release uses the baked bass release (0.18) when input falls (asymmetry)', () => {
    const calls: DriveCall[] = [];
    const driver = createAudioZonesDriver({
      getDefaultIntensity: () => defaultIntensity,
      getRingCount: () => 1,
      getRing: () => makeRing(),
      readZones: (() => {
        let n = 0;
        return () => ({ bass: n++ === 0 ? 1 : 0, mid: 0, treble: 0 });
      })(),
      applyRingZoneDrive: (index, drive) => calls.push({ index, drive })
    });
    driver.init();
    driver.frame(0); // respond(1)=1, attack 0.35 → smoothed = 0.35
    expect(calls[0].drive?.bassPush).toBeCloseTo(0.35 * defaultIntensity.bass, 6);
    driver.frame(16); // raw 0 → respond 0, release 0.18 → 0.35 + (0-0.35)*0.18 = 0.287
    expect(calls[1].drive?.bassPush).toBeCloseTo((0.35 + (0 - 0.35) * 0.18) * defaultIntensity.bass, 6);
  });

  it('init() resets smoothed state between runs', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 1, mid: 0, treble: 0 }, calls });
    driver.init();
    driver.frame(0); // smoothed = 0.35
    driver.init(); // reset to 0
    driver.frame(0); // smoothed = 0.35 again, not compounding
    expect(calls[1].drive?.bassPush).toBeCloseTo(0.35 * defaultIntensity.bass, 6);
  });

  it('treble: trebleRetract = respond(treble) * treble attack * intensity (first frame)', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0, treble: 0.4 }, calls });
    driver.init();
    driver.frame(0);
    const expected =
      respondExpect(0.4, RESP.treble.floor, RESP.treble.sat) *
      ENVELOPE.treble.attack *
      defaultIntensity.treble;
    expect(calls[0].drive?.trebleRetract).toBeCloseTo(expected, 6);
  });

  it('treble vibrate equals retract times the sine phase, same frame', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0, treble: 0.4 }, calls });
    driver.init();
    // phase = sin(2*pi*8*1)=0 → vibrate ≈ 0 even though retract is non-zero
    driver.frame(1000);
    expect(calls[0].drive?.trebleVibrate).toBeCloseTo(0, 6);
    expect(calls[0].drive?.trebleRetract ?? 0).toBeGreaterThan(0);
    // phase = sin(2*pi*8*0.03125)=sin(pi/2)=1 → vibrate equals retract this frame
    driver.frame(31.25);
    const d = calls[1].drive!;
    expect(d.trebleVibrate).toBeCloseTo(d.trebleRetract, 6);
  });

  it('frame() applies per-ring zoneConfig override', () => {
    const calls: DriveCall[] = [];
    const override: ZoneIntensity = { bass: 1.0, mid: 0, treble: 0 };
    const driver = makeDriver({
      ringCount: 1,
      zones: { bass: 0.5, mid: 0, treble: 0 },
      calls,
      rings: [makeRing(override)]
    });
    driver.init();
    driver.frame(0);
    const expected = respondExpect(0.5, RESP.bass.floor, RESP.bass.sat) * ENVELOPE.bass.attack * 1.0;
    expect(calls[0].drive?.bassPush).toBeCloseTo(expected, 6);
  });

  it('frame() returns {}', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ calls });
    driver.init();
    expect(driver.frame(0)).toEqual({});
  });

  it('dispose() sets zoneDrive to null for every ring', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 3, calls });
    driver.dispose();
    expect(calls).toEqual([
      { index: 0, drive: null },
      { index: 1, drive: null },
      { index: 2, drive: null }
    ]);
  });

  it('sanitizes a non-integer ring count before iterating', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 2.8, calls });
    driver.init();
    driver.frame(0);
    expect(calls.map((c) => c.index)).toEqual([0, 1]);
  });
});
