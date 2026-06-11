import { describe, expect, it } from 'vitest';
import type { Ring, ZoneIntensity, ZoneDrive } from '$lib/types';
import { createAudioZonesDriver } from './audio-zones-driver';
import { ZONE_SCALE } from '$lib/geometry/zones';

const defaultIntensity: ZoneIntensity = { bass: 0.5, mid: 0.5, treble: 0.5 };

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
    driver.frame(0);
    expect(calls).toHaveLength(2);
    expect(calls[0].index).toBe(0);
    expect(calls[1].index).toBe(1);
    expect(calls[0].drive).not.toBeNull();
    expect(calls[1].drive).not.toBeNull();
  });

  it('frame() scales bassPush by bass * intensity.bass * ZONE_SCALE', () => {
    const calls: DriveCall[] = [];
    // bass=0.5, defaultIntensity.bass=0.5 → bassPush = 0.5*0.5*ZONE_SCALE
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0.5, mid: 0, treble: 0 }, calls });
    driver.frame(0);
    expect(calls[0].drive?.bassPush).toBeCloseTo(0.5 * 0.5 * ZONE_SCALE, 4);
  });

  it('frame() scales midPush by mid * intensity.mid * ZONE_SCALE', () => {
    const calls: DriveCall[] = [];
    // mid=0.8, defaultIntensity.mid=0.5 → midPush = 0.8*0.5*ZONE_SCALE
    const driver = makeDriver({ ringCount: 1, zones: { bass: 0, mid: 0.8, treble: 0 }, calls });
    driver.frame(0);
    expect(calls[0].drive?.midPush).toBeCloseTo(0.8 * 0.5 * ZONE_SCALE, 4);
  });

  it('frame() applies per-ring zoneConfig override', () => {
    const calls: DriveCall[] = [];
    const override: ZoneIntensity = { bass: 1.0, mid: 0, treble: 0 };
    // bass=0.5, override.bass=1.0 → bassPush = 0.5*1.0*ZONE_SCALE
    const driver = makeDriver({
      ringCount: 1,
      zones: { bass: 0.5, mid: 0, treble: 0 },
      calls,
      rings: [makeRing(override)]
    });
    driver.frame(0);
    expect(calls[0].drive?.bassPush).toBeCloseTo(0.5 * 1.0 * ZONE_SCALE, 4);
  });

  it('frame() returns {}', () => {
    const calls: DriveCall[] = [];
    const driver = makeDriver({ calls });
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
    driver.frame(0);
    expect(calls.map((c) => c.index)).toEqual([0, 1]);
  });
});
