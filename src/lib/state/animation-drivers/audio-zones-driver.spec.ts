import { describe, expect, it } from 'vitest';
import type { Ring, ZoneIntensity, ZoneDrive, EnvelopeParams } from '$lib/types';
import { createAudioZonesDriver } from './audio-zones-driver';
import { ZONE_SCALE } from '$lib/geometry/zones';

const defaultIntensity: ZoneIntensity = { bass: 0.5, mid: 0.5, treble: 0.5 };
const instant: EnvelopeParams = { attack: 1, release: 1 };
const instantEnvelopes = { bass: instant, mid: instant, treble: instant };

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
  envelopes?: { bass: EnvelopeParams; mid: EnvelopeParams; treble: EnvelopeParams };
  calls: DriveCall[];
  rings?: Ring[];
}) {
  const rings = overrides.rings ?? [];
  return createAudioZonesDriver({
    getDefaultIntensity: () => defaultIntensity,
    getRingCount: () => overrides.ringCount ?? 2,
    getRing: (i) => rings[i] ?? makeRing(),
    readZones: () => overrides.zones ?? { bass: 0.5, mid: 0.8, treble: 0.3 },
    getEnvelopes: () => overrides.envelopes ?? instantEnvelopes,
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

  it('frame() with instant attack scales bassPush by bass * intensity.bass * ZONE_SCALE', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0.5, mid: 0, treble: 0 }, calls });
    driver.init();
    driver.frame(0);
    expect(calls[0].drive?.bassPush).toBeCloseTo(0.5 * 0.5 * ZONE_SCALE, 4);
  });

  it('frame() with instant attack scales midPush by mid * intensity.mid * ZONE_SCALE', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0.8, treble: 0 }, calls });
    driver.init();
    driver.frame(0);
    expect(calls[0].drive?.midPush).toBeCloseTo(0.8 * 0.5 * ZONE_SCALE, 4);
  });

  it('attack ramps the smoothed level toward raw on rising input', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({
      ringCount: 1,
      zones: { bass: 1, mid: 0, treble: 0 },
      envelopes: { bass: { attack: 0.5, release: 0.5 }, mid: instant, treble: instant },
      calls
    });
    driver.init();
    driver.frame(0);
    expect(calls[0].drive?.bassPush).toBeCloseTo(0.5 * 0.5 * ZONE_SCALE, 4);
    driver.frame(16);
    expect(calls[1].drive?.bassPush).toBeCloseTo(0.75 * 0.5 * ZONE_SCALE, 4);
  });

  it('release decays slower than attack rises (asymmetry)', () => {
    const calls: DriveCall[] = [];
    const driver = createAudioZonesDriver({
      getDefaultIntensity: () => defaultIntensity,
      getRingCount: () => 1,
      getRing: () => makeRing(),
      readZones: (() => {
        let n = 0;
        return () => ({ bass: n++ === 0 ? 1 : 0, mid: 0, treble: 0 });
      })(),
      getEnvelopes: () => ({
        bass: { attack: 1, release: 0.25 },
        mid: instant,
        treble: instant
      }),
      applyRingZoneDrive: (index, drive) => calls.push({ index, drive })
    });
    driver.init();
    driver.frame(0); // attack 1 → smoothed.bass = 1
    expect(calls[0].drive?.bassPush).toBeCloseTo(1 * 0.5 * ZONE_SCALE, 4);
    driver.frame(16); // raw 0, release 0.25 → smoothed = lerp(1,0,0.25)=0.75
    expect(calls[1].drive?.bassPush).toBeCloseTo(0.75 * 0.5 * ZONE_SCALE, 4);
  });

  it('init() resets smoothed state between runs', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({
      ringCount: 1,
      zones: { bass: 1, mid: 0, treble: 0 },
      envelopes: { bass: { attack: 0.5, release: 0.5 }, mid: instant, treble: instant },
      calls
    });
    driver.init();
    driver.frame(0); // smoothed.bass = 0.5
    driver.init(); // reset to 0
    driver.frame(0); // smoothed.bass = 0.5 again, not 0.75
    expect(calls[1].drive?.bassPush).toBeCloseTo(0.5 * 0.5 * ZONE_SCALE, 4);
  });

  it('treble: trebleRetract = smoothed.treble * intensity * ZONE_SCALE', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0, treble: 0.4 }, calls });
    driver.init();
    driver.frame(0);
    // instant attack → smoothed.treble = 0.4; intensity 0.5
    expect(calls[0].drive?.trebleRetract).toBeCloseTo(0.4 * 0.5 * ZONE_SCALE, 4);
  });

  it('treble: trebleVibrate sign follows sin(2*pi*8*t)', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0, treble: 0.4 }, calls });
    driver.init();
    // nowSec=1.0 → sin(2*pi*8*1)=0 → vibrate≈0
    driver.frame(1000);
    expect(calls[0].drive?.trebleVibrate).toBeCloseTo(0, 4);
    // nowMs=31.25 → 8*t = 0.25 → sin>0
    driver.frame(31.25);
    expect(calls[1].drive?.trebleVibrate ?? 0).toBeGreaterThan(0);
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
    expect(calls[0].drive?.bassPush).toBeCloseTo(0.5 * 1.0 * ZONE_SCALE, 4);
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
