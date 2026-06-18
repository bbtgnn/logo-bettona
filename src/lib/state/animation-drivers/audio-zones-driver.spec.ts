import { describe, expect, it } from 'vitest';
import type { Ring, ZoneIntensity, ZoneDrive, EnvelopeParams } from '$lib/types';
import { createAudioZonesDriver } from './audio-zones-driver';

const defaultIntensity: ZoneIntensity = { bass: 0.5, mid: 0.5, treble: 0.5 };
const instant: EnvelopeParams = { attack: 1, release: 1 };
const instantEnvelopes = { bass: instant, mid: instant, treble: instant };

// Mirror of the driver's per-band threshold→expand response curve, for expectations.
const RESP = {
  bass: { floor: 0.235, sat: 0.863 },
  mid: { floor: 0.196, sat: 0.863 },
  treble: { floor: 0.275, sat: 0.863 }
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

  it('frame() emits normalized bassPush = respond(raw) * intensity (instant attack)', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0.5, mid: 0, treble: 0 }, calls });
    driver.init();
    driver.frame(0);
    const expected = respondExpect(0.5, RESP.bass.floor, RESP.bass.sat) * defaultIntensity.bass;
    expect(calls[0].drive?.bassPush).toBeCloseTo(expected, 6);
  });

  it('frame() emits normalized midPush = respond(raw) * intensity (instant attack)', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0.8, treble: 0 }, calls });
    driver.init();
    driver.frame(0);
    const expected = respondExpect(0.8, RESP.mid.floor, RESP.mid.sat) * defaultIntensity.mid;
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

  it('frame() saturates an above-sat band to intensity (1 * intensity)', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 1.0, mid: 0, treble: 0 }, calls });
    driver.init();
    driver.frame(0);
    expect(calls[0].drive?.bassPush).toBeCloseTo(defaultIntensity.bass, 6);
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

  it('attack ramps the smoothed level toward raw on rising input', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({
      ringCount: 1,
      zones: { bass: 1, mid: 0, treble: 0 }, // respond(1) = 1
      envelopes: { bass: { attack: 0.5, release: 0.5 }, mid: instant, treble: instant },
      calls
    });
    driver.init();
    driver.frame(0);
    expect(calls[0].drive?.bassPush).toBeCloseTo(0.5 * 0.5, 6);
    driver.frame(16);
    expect(calls[1].drive?.bassPush).toBeCloseTo(0.75 * 0.5, 6);
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
    driver.frame(0); // respond(1)=1, attack 1 → smoothed.bass = 1
    expect(calls[0].drive?.bassPush).toBeCloseTo(1 * 0.5, 6);
    driver.frame(16); // raw 0 → respond 0, release 0.25 → smoothed = lerp(1,0,0.25)=0.75
    expect(calls[1].drive?.bassPush).toBeCloseTo(0.75 * 0.5, 6);
  });

  it('init() resets smoothed state between runs', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({
      ringCount: 1,
      zones: { bass: 1, mid: 0, treble: 0 }, // respond(1) = 1
      envelopes: { bass: { attack: 0.5, release: 0.5 }, mid: instant, treble: instant },
      calls
    });
    driver.init();
    driver.frame(0); // smoothed.bass = 0.5
    driver.init(); // reset to 0
    driver.frame(0); // smoothed.bass = 0.5 again, not 0.75
    expect(calls[1].drive?.bassPush).toBeCloseTo(0.5 * 0.5, 6);
  });

  it('treble: trebleRetract = respond(treble) * intensity (instant attack)', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0, treble: 0.4 }, calls });
    driver.init();
    driver.frame(0);
    const expected = respondExpect(0.4, RESP.treble.floor, RESP.treble.sat) * defaultIntensity.treble;
    expect(calls[0].drive?.trebleRetract).toBeCloseTo(expected, 6);
  });

  it('treble: trebleVibrate = trebleRetract * sin(2*pi*8*t)', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0, treble: 0.4 }, calls });
    driver.init();
    // nowSec=1.0 → sin(2*pi*8*1)=0 → vibrate≈0
    driver.frame(1000);
    expect(calls[0].drive?.trebleVibrate).toBeCloseTo(0, 6);
    // nowMs=31.25 → 8*t = 0.25 → sin(pi/2)=1 → full-amplitude vibrate = trebleRetract * 1
    driver.frame(31.25);
    const trebleNorm = respondExpect(0.4, RESP.treble.floor, RESP.treble.sat) * defaultIntensity.treble;
    expect(calls[1].drive?.trebleVibrate).toBeCloseTo(trebleNorm, 6);
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
    const expected = respondExpect(0.5, RESP.bass.floor, RESP.bass.sat) * 1.0;
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
