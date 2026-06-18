import { describe, expect, it } from 'vitest';
import type { Ring, ZoneIntensity, ZoneDrive } from '$lib/types';
import { createAudioZonesDriver, ENVELOPE, RESPONSE as RESP } from './audio-zones-driver';

const defaultIntensity: ZoneIntensity = { bass: 0.5, mid: 0.5, treble: 0.5 };

// RESP/ENVELOPE are imported from the driver so these tests verify the smoothing MECHANIC
// against the live attack/release values — they stay green when the values are tuned.
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
    driver.frame(31.25);
    const d = calls[0].drive!;
    expect(d.bassPush).toBeGreaterThanOrEqual(0);
    expect(d.bassPush).toBeLessThanOrEqual(1);
    expect(d.midPush).toBeLessThanOrEqual(1);
    expect(d.trebleRetract).toBeLessThanOrEqual(1);
    expect(Math.abs(d.trebleVibrate)).toBeLessThanOrEqual(1);
  });

  it('attack rate governs the rise on rising input', () => {
    const a = ENVELOPE.bass.attack;
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 1, mid: 0, treble: 0 }, calls }); // respond(1)=1
    driver.init();
    driver.frame(0); // smoothed = 0 + (1-0)*a
    expect(calls[0].drive?.bassPush).toBeCloseTo(a * defaultIntensity.bass, 6);
    driver.frame(16); // smoothed = a + (1-a)*a
    expect(calls[1].drive?.bassPush).toBeCloseTo((a + (1 - a) * a) * defaultIntensity.bass, 6);
  });

  it('release rate (distinct from attack) governs the fall — asymmetry', () => {
    const a = ENVELOPE.bass.attack;
    const r = ENVELOPE.bass.release;
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
    driver.frame(0); // respond(1)=1, attack → smoothed = a
    expect(calls[0].drive?.bassPush).toBeCloseTo(a * defaultIntensity.bass, 6);
    driver.frame(16); // raw 0 → respond 0, release → a + (0-a)*r
    expect(calls[1].drive?.bassPush).toBeCloseTo((a + (0 - a) * r) * defaultIntensity.bass, 6);
  });

  it('init() resets smoothed state between runs', () => {
    const a = ENVELOPE.bass.attack;
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 1, mid: 0, treble: 0 }, calls });
    driver.init();
    driver.frame(0); // smoothed = a
    driver.init(); // reset to 0
    driver.frame(0); // smoothed = a again, not compounding
    expect(calls[1].drive?.bassPush).toBeCloseTo(a * defaultIntensity.bass, 6);
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

  it('treble vibrate is a smooth magnitude (== retract), with no time/phase dependence', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0, treble: 0.4 }, calls });
    driver.init();
    // No 8Hz oscillator: vibrate tracks retract and does not depend on nowMs.
    driver.frame(1000);
    const a = calls[0].drive!;
    expect(a.trebleRetract).toBeGreaterThan(0);
    expect(a.trebleVibrate).toBeCloseTo(a.trebleRetract, 6);
    driver.frame(31.25);
    const b = calls[1].drive!;
    expect(b.trebleVibrate).toBeCloseTo(b.trebleRetract, 6);
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
